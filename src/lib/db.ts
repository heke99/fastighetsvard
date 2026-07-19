import "server-only";
import { randomUUID } from "node:crypto";
import schemaJson from "./database-schema.json";
import { createAdminClient } from "./supabase/admin";

type PlainObject = Record<string, any>;
type RelationMeta = {
  target: string;
  many: boolean;
  localFields: string[];
  targetFields: string[];
  relationName?: string | null;
  reverse: boolean;
  oppositeField?: string;
};
type ModelMeta = {
  table: string;
  scalars: string[];
  dates: string[];
  json: string[];
  enums: Record<string, string>;
  relations: Record<string, RelationMeta>;
};

const schema = schemaJson as unknown as {
  models: Record<string, ModelMeta>;
  enums: Record<string, string[]>;
};

function isObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function modelFromDelegate(delegate: string): string {
  const candidate = delegate.charAt(0).toUpperCase() + delegate.slice(1);
  if (!schema.models[candidate]) throw new Error(`Okänd databasmodell: ${delegate}`);
  return candidate;
}

function serializeValue(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (isObject(value)) {
    const result: PlainObject = {};
    for (const [key, item] of Object.entries(value)) result[key] = serializeValue(item);
    return result;
  }
  return value;
}

function hydrateRow(model: string, row: any): any {
  if (!row) return row;
  const meta = schema.models[model];
  const hydrated: PlainObject = { ...row };
  for (const field of meta.dates) {
    if (hydrated[field] != null && !(hydrated[field] instanceof Date)) {
      hydrated[field] = new Date(hydrated[field]);
    }
  }
  return hydrated;
}

function compareValues(a: any, b: any): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

function scalarMatches(actual: any, condition: any): boolean {
  if (!isObject(condition)) {
    if (condition instanceof Date) return compareValues(actual, condition) === 0;
    return actual === condition;
  }
  const insensitive = condition.mode === "insensitive";
  const normalize = (value: any) =>
    insensitive && typeof value === "string" ? value.toLocaleLowerCase("sv-SE") : value;
  const a = normalize(actual);

  for (const [op, rawExpected] of Object.entries(condition)) {
    if (op === "mode") continue;
    const expected = normalize(rawExpected);
    if (op === "equals" && !scalarMatches(actual, rawExpected)) return false;
    if (op === "not") {
      if (isObject(rawExpected)) {
        if (scalarMatches(actual, rawExpected)) return false;
      } else if (scalarMatches(actual, rawExpected)) return false;
    }
    if (op === "in" && (!Array.isArray(rawExpected) || !rawExpected.some((x) => scalarMatches(actual, x)))) return false;
    if (op === "notIn" && Array.isArray(rawExpected) && rawExpected.some((x) => scalarMatches(actual, x))) return false;
    if (op === "lt" && !(compareValues(actual, rawExpected) < 0)) return false;
    if (op === "lte" && !(compareValues(actual, rawExpected) <= 0)) return false;
    if (op === "gt" && !(compareValues(actual, rawExpected) > 0)) return false;
    if (op === "gte" && !(compareValues(actual, rawExpected) >= 0)) return false;
    if (op === "contains") {
      if (typeof a === "string" && typeof expected === "string") {
        if (!a.includes(expected)) return false;
      } else if (Array.isArray(actual)) {
        if (!actual.includes(rawExpected)) return false;
      } else return false;
    }
    if (op === "startsWith" && (typeof a !== "string" || typeof expected !== "string" || !a.startsWith(expected))) return false;
    if (op === "endsWith" && (typeof a !== "string" || typeof expected !== "string" || !a.endsWith(expected))) return false;
    if (op === "has" && (!Array.isArray(actual) || !actual.includes(rawExpected))) return false;
    if (op === "hasSome" && (!Array.isArray(actual) || !Array.isArray(rawExpected) || !rawExpected.some((x) => actual.includes(x)))) return false;
    if (op === "hasEvery" && (!Array.isArray(actual) || !Array.isArray(rawExpected) || !rawExpected.every((x) => actual.includes(x)))) return false;
  }
  return true;
}

class QueryContext {
  rows = new Map<string, any[]>();
  relations = new Map<string, any>();
}

class ModelDelegate {
  constructor(private readonly database: SupabaseDatabase, private readonly model: string) {}

  private get meta() {
    return schema.models[this.model];
  }

  private async all(context = new QueryContext()): Promise<any[]> {
    const cached = context.rows.get(this.model);
    if (cached) return cached;
    const client = createAdminClient();
    const result: any[] = [];
    let from = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await client.from(this.meta.table).select("*").range(from, from + size - 1);
      if (error) throw new Error(`Supabase ${this.meta.table}: ${error.message}`);
      const page = (data ?? []).map((row) => hydrateRow(this.model, row));
      result.push(...page);
      if (page.length < size) break;
      from += size;
    }
    context.rows.set(this.model, result);
    return result;
  }

  private async relationValue(row: PlainObject, field: string, context: QueryContext): Promise<any> {
    const relation = this.meta.relations[field];
    if (!relation) return undefined;
    const cacheKey = `${this.model}:${row.id ?? JSON.stringify(row)}:${field}`;
    if (context.relations.has(cacheKey)) return context.relations.get(cacheKey);

    const target = this.database.delegate(relation.target);
    const targetRows = await target.all(context);
    const matches = targetRows.filter((candidate) =>
      relation.localFields.every((localField, index) => {
        const targetField = relation.targetFields[index] ?? "id";
        return candidate[targetField] === row[localField];
      })
    );
    const value = relation.many ? matches : matches[0] ?? null;
    context.relations.set(cacheKey, value);
    return value;
  }

  private async matches(row: PlainObject, where: PlainObject | undefined, context: QueryContext): Promise<boolean> {
    if (!where || Object.keys(where).length === 0) return true;
    for (const [field, condition] of Object.entries(where)) {
      if (field === "AND") {
        const conditions = Array.isArray(condition) ? condition : [condition];
        for (const item of conditions) if (!(await this.matches(row, item, context))) return false;
        continue;
      }
      if (field === "OR") {
        const conditions = Array.isArray(condition) ? condition : [condition];
        let ok = false;
        for (const item of conditions) if (await this.matches(row, item, context)) { ok = true; break; }
        if (!ok) return false;
        continue;
      }
      if (field === "NOT") {
        const conditions = Array.isArray(condition) ? condition : [condition];
        for (const item of conditions) if (await this.matches(row, item, context)) return false;
        continue;
      }

      const relation = this.meta.relations[field];
      if (relation) {
        const value = await this.relationValue(row, field, context);
        if (relation.many) {
          const list = value as PlainObject[];
          if (isObject(condition) && "some" in condition) {
            let found = false;
            for (const item of list) if (await this.database.delegate(relation.target).matches(item, condition.some, context)) { found = true; break; }
            if (!found) return false;
          } else if (isObject(condition) && "none" in condition) {
            for (const item of list) if (await this.database.delegate(relation.target).matches(item, condition.none, context)) return false;
          } else if (isObject(condition) && "every" in condition) {
            for (const item of list) if (!(await this.database.delegate(relation.target).matches(item, condition.every, context))) return false;
          } else {
            let found = false;
            for (const item of list) if (await this.database.delegate(relation.target).matches(item, condition as PlainObject, context)) { found = true; break; }
            if (!found) return false;
          }
        } else {
          if (condition === null) {
            if (value !== null) return false;
          } else if (isObject(condition) && "is" in condition) {
            if (!value || !(await this.database.delegate(relation.target).matches(value, condition.is, context))) return false;
          } else if (isObject(condition) && "isNot" in condition) {
            if (value && await this.database.delegate(relation.target).matches(value, condition.isNot, context)) return false;
          } else if (!value || !(await this.database.delegate(relation.target).matches(value, condition as PlainObject, context))) return false;
        }
        continue;
      }

      if (this.meta.scalars.includes(field)) {
        if (!scalarMatches(row[field], condition)) return false;
        continue;
      }

      // Composite unique selectors, e.g. organizationId_domain.
      if (isObject(condition)) {
        for (const [nestedField, nestedCondition] of Object.entries(condition)) {
          if (!scalarMatches(row[nestedField], nestedCondition)) return false;
        }
        continue;
      }
      return false;
    }
    return true;
  }

  private async applyProjection(row: PlainObject, args: PlainObject, context: QueryContext): Promise<any> {
    const select = args.select as PlainObject | undefined;
    const include = args.include as PlainObject | undefined;
    let result: PlainObject = select ? {} : { ...row };

    if (select) {
      for (const [field, config] of Object.entries(select)) {
        if (!config) continue;
        if (field === "_count") {
          result._count = await this.countRelations(row, config, context);
        } else if (this.meta.relations[field]) {
          result[field] = await this.projectRelation(row, field, config, context);
        } else {
          result[field] = row[field];
        }
      }
    }

    if (include) {
      for (const [field, config] of Object.entries(include)) {
        if (!config) continue;
        if (field === "_count") result._count = await this.countRelations(row, config, context);
        else if (this.meta.relations[field]) result[field] = await this.projectRelation(row, field, config, context);
      }
    }
    return result;
  }

  private async countRelations(row: PlainObject, config: any, context: QueryContext) {
    const selected = config === true ? Object.fromEntries(Object.keys(this.meta.relations).map((x) => [x, true])) : config.select ?? {};
    const result: PlainObject = {};
    for (const [field, relationConfig] of Object.entries(selected)) {
      const relation = this.meta.relations[field];
      if (!relation) continue;
      let value = await this.relationValue(row, field, context);
      const where = isObject(relationConfig) ? relationConfig.where : undefined;
      if (!Array.isArray(value)) value = value ? [value] : [];
      if (where) {
        const filtered: any[] = [];
        for (const item of value) if (await this.database.delegate(relation.target).matches(item, where, context)) filtered.push(item);
        value = filtered;
      }
      result[field] = value.length;
    }
    return result;
  }

  private async projectRelation(row: PlainObject, field: string, config: any, context: QueryContext) {
    const relation = this.meta.relations[field];
    const delegate = this.database.delegate(relation.target);
    let value = await this.relationValue(row, field, context);
    const nestedArgs = config === true ? {} : config ?? {};
    if (relation.many) {
      let rows = [...(value as PlainObject[])];
      if (nestedArgs.where) {
        const filtered: any[] = [];
        for (const item of rows) if (await delegate.matches(item, nestedArgs.where, context)) filtered.push(item);
        rows = filtered;
      }
      rows = delegate.sortRows(rows, nestedArgs.orderBy);
      if (nestedArgs.distinct) rows = delegate.distinctRows(rows, nestedArgs.distinct);
      rows = rows.slice(nestedArgs.skip ?? 0, nestedArgs.take ? (nestedArgs.skip ?? 0) + nestedArgs.take : undefined);
      return Promise.all(rows.map((item) => delegate.applyProjection(item, nestedArgs, context)));
    }
    if (!value) return null;
    if (nestedArgs.where && !(await delegate.matches(value, nestedArgs.where, context))) return null;
    return delegate.applyProjection(value, nestedArgs, context);
  }

  private sortRows(rows: any[], orderBy: any): any[] {
    if (!orderBy) return rows;
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((left, right) => {
      for (const order of orders) {
        for (const [field, directionValue] of Object.entries(order)) {
          const direction = isObject(directionValue) ? directionValue.sort ?? "asc" : directionValue;
          const compared = compareValues(left[field], right[field]);
          if (compared !== 0) return direction === "desc" ? -compared : compared;
        }
      }
      return 0;
    });
  }

  private distinctRows(rows: any[], distinct: string | string[]): any[] {
    const fields = Array.isArray(distinct) ? distinct : [distinct];
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = JSON.stringify(fields.map((field) => row[field]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async findMany(args: PlainObject = {}): Promise<any[]> {
    const context = new QueryContext();
    const all = await this.all(context);
    const filtered: any[] = [];
    for (const row of all) if (await this.matches(row, args.where, context)) filtered.push(row);
    let rows = this.sortRows(filtered, args.orderBy);
    if (args.distinct) rows = this.distinctRows(rows, args.distinct);
    const start = args.skip ?? 0;
    rows = rows.slice(start, args.take == null ? undefined : start + args.take);
    return Promise.all(rows.map((row) => this.applyProjection(row, args, context)));
  }

  async findFirst(args: PlainObject = {}): Promise<any | null> {
    const rows = await this.findMany({ ...args, take: 1 });
    return rows[0] ?? null;
  }

  async findUnique(args: PlainObject): Promise<any | null> {
    return this.findFirst(args);
  }

  private splitData(data: PlainObject) {
    const scalar: PlainObject = {};
    const relation: PlainObject = {};
    for (const [field, value] of Object.entries(data)) {
      if (this.meta.relations[field]) relation[field] = value;
      else if (this.meta.scalars.includes(field)) scalar[field] = value;
    }
    return { scalar, relation };
  }

  private async prepareForwardRelations(scalar: PlainObject, relations: PlainObject) {
    for (const [field, operation] of Object.entries(relations)) {
      const relation = this.meta.relations[field];
      if (!relation || relation.reverse || !isObject(operation)) continue;
      if (operation.connect) {
        relation.localFields.forEach((localField, index) => {
          const targetField = relation.targetFields[index] ?? "id";
          scalar[localField] = operation.connect[targetField];
        });
      } else if (operation.create) {
        const target = await this.database.delegate(relation.target).create({ data: operation.create });
        relation.localFields.forEach((localField, index) => {
          scalar[localField] = target[relation.targetFields[index] ?? "id"];
        });
      }
    }
  }

  private async processReverseRelations(row: PlainObject, relations: PlainObject) {
    for (const [field, operation] of Object.entries(relations)) {
      const relation = this.meta.relations[field];
      if (!relation || !relation.reverse || !isObject(operation)) continue;
      const targetDelegate = this.database.delegate(relation.target);
      const bind = (data: PlainObject) => {
        const result = { ...data };
        relation.targetFields.forEach((targetField, index) => {
          result[targetField] = row[relation.localFields[index] ?? "id"];
        });
        return result;
      };
      if (operation.create) {
        const creates = Array.isArray(operation.create) ? operation.create : [operation.create];
        for (const item of creates) await targetDelegate.create({ data: bind(item) });
      }
      if (operation.createMany?.data) {
        for (const item of operation.createMany.data) await targetDelegate.create({ data: bind(item) });
      }
      if (operation.deleteMany) {
        const conditions = operation.deleteMany === true ? {} : operation.deleteMany;
        await targetDelegate.deleteMany({ where: { ...conditions, ...bind({}) } });
      }
    }
  }

  async create(args: PlainObject): Promise<any> {
    const { scalar, relation } = this.splitData(args.data ?? {});
    await this.prepareForwardRelations(scalar, relation);
    if (this.meta.scalars.includes("id") && !scalar.id) scalar.id = randomUUID();
    if (this.meta.scalars.includes("createdAt") && !scalar.createdAt) scalar.createdAt = new Date();
    if (this.meta.scalars.includes("updatedAt") && !scalar.updatedAt) scalar.updatedAt = new Date();
    const client = createAdminClient();
    const { data, error } = await client.from(this.meta.table).insert(serializeValue(scalar)).select("*").single();
    if (error) throw new Error(`Supabase ${this.meta.table}.create: ${error.message}`);
    const row = hydrateRow(this.model, data);
    await this.processReverseRelations(row, relation);
    return this.applyProjection(row, args, new QueryContext());
  }

  private applyUpdateOperators(current: PlainObject, data: PlainObject): PlainObject {
    const result: PlainObject = {};
    for (const [field, value] of Object.entries(data)) {
      if (!this.meta.scalars.includes(field)) continue;
      if (isObject(value) && "increment" in value) result[field] = Number(current[field] ?? 0) + Number(value.increment);
      else if (isObject(value) && "decrement" in value) result[field] = Number(current[field] ?? 0) - Number(value.decrement);
      else if (isObject(value) && "set" in value) result[field] = value.set;
      else result[field] = value;
    }
    if (this.meta.scalars.includes("updatedAt") && !("updatedAt" in result)) result.updatedAt = new Date();
    return result;
  }

  async update(args: PlainObject): Promise<any> {
    const current = await this.findFirst({ where: args.where });
    if (!current) throw new Error(`${this.model} kunde inte hittas för uppdatering.`);
    const { relation } = this.splitData(args.data ?? {});
    const updates = this.applyUpdateOperators(current, args.data ?? {});
    const client = createAdminClient();
    const { data, error } = await client.from(this.meta.table).update(serializeValue(updates)).eq("id", current.id).select("*").single();
    if (error) throw new Error(`Supabase ${this.meta.table}.update: ${error.message}`);
    const row = hydrateRow(this.model, data);
    await this.processReverseRelations(row, relation);
    return this.applyProjection(row, args, new QueryContext());
  }

  async updateMany(args: PlainObject): Promise<{ count: number }> {
    const rows = await this.findMany({ where: args.where });
    for (const row of rows) await this.update({ where: { id: row.id }, data: args.data });
    return { count: rows.length };
  }

  async delete(args: PlainObject): Promise<any> {
    const current = await this.findFirst({ where: args.where });
    if (!current) throw new Error(`${this.model} kunde inte hittas för borttagning.`);
    const client = createAdminClient();
    const { error } = await client.from(this.meta.table).delete().eq("id", current.id);
    if (error) throw new Error(`Supabase ${this.meta.table}.delete: ${error.message}`);
    return current;
  }

  async deleteMany(args: PlainObject = {}): Promise<{ count: number }> {
    const rows = await this.findMany({ where: args.where });
    for (const row of rows) await this.delete({ where: { id: row.id } });
    return { count: rows.length };
  }

  async upsert(args: PlainObject): Promise<any> {
    const existing = await this.findFirst({ where: args.where });
    return existing
      ? this.update({ where: { id: existing.id }, data: args.update, include: args.include, select: args.select })
      : this.create({ data: args.create, include: args.include, select: args.select });
  }

  async count(args: PlainObject = {}): Promise<number> {
    return (await this.findMany({ where: args.where, distinct: args.distinct })).length;
  }

  async aggregate(args: PlainObject = {}): Promise<any> {
    const rows = await this.findMany({ where: args.where });
    const result: PlainObject = {};
    const operations = ["_sum", "_avg", "_min", "_max", "_count"];
    for (const operation of operations) {
      if (!args[operation]) continue;
      if (operation === "_count" && args[operation] === true) { result._count = rows.length; continue; }
      result[operation] = {};
      for (const [field, enabled] of Object.entries(args[operation])) {
        if (!enabled) continue;
        const values = rows.map((row) => row[field]).filter((value) => value != null);
        if (operation === "_sum") result[operation][field] = values.reduce((sum, value) => sum + Number(value), 0);
        if (operation === "_avg") result[operation][field] = values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : null;
        if (operation === "_min") result[operation][field] = values.length ? values.reduce((a, b) => compareValues(a, b) <= 0 ? a : b) : null;
        if (operation === "_max") result[operation][field] = values.length ? values.reduce((a, b) => compareValues(a, b) >= 0 ? a : b) : null;
        if (operation === "_count") result[operation][field] = values.length;
      }
    }
    return result;
  }

  async groupBy(args: PlainObject): Promise<any[]> {
    const rows = await this.findMany({ where: args.where });
    const by: string[] = args.by ?? [];
    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const key = JSON.stringify(by.map((field) => row[field]));
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    const result: any[] = [];
    for (const groupRows of groups.values()) {
      const item: PlainObject = {};
      by.forEach((field) => item[field] = groupRows[0][field]);
      if (args._count) item._count = args._count === true ? groupRows.length : Object.fromEntries(Object.keys(args._count).map((field) => [field, groupRows.filter((row) => row[field] != null).length]));
      if (args._sum) item._sum = Object.fromEntries(Object.keys(args._sum).map((field) => [field, groupRows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0)]));
      result.push(item);
    }
    return this.sortRows(result, args.orderBy);
  }
}

export class SupabaseDatabase {
  [key: string]: any;
  private delegates = new Map<string, ModelDelegate>();

  delegate(model: string): ModelDelegate {
    let delegate = this.delegates.get(model);
    if (!delegate) {
      delegate = new ModelDelegate(this, model);
      this.delegates.set(model, delegate);
    }
    return delegate;
  }

  async $transaction<T>(callback: (tx: SupabaseDatabase) => Promise<T>): Promise<T> {
    // Supabase Data API requests are individually atomic. Multi-step domain operations
    // are guarded by database constraints/idempotency and should move to RPC when a
    // single PostgreSQL transaction is required.
    return callback(this);
  }

  async $disconnect(): Promise<void> {}
}

const core = new SupabaseDatabase();

export const db = new Proxy(core as SupabaseDatabase & Record<string, any>, {
  get(target, property, receiver) {
    if (typeof property === "string" && !(property in target)) {
      return target.delegate(modelFromDelegate(property));
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
