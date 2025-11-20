import type { QueryParams } from '@/types'
import type { LocationQuery, LocationQueryValue } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

type GetAs = 'string' | 'number' | 'boolean' | 'array'
type GetOptions<T> = {
  as?: GetAs
  /** If true, '' and null are treated as undefined (default: true) */
  emptyIsUndefined?: boolean
  /** Trim whitespace for string/array values (default: true) */
  trim?: boolean
  /** Fallback when value is missing/empty/NaN */
  default?: T
}
type AnyOptions = GetOptions<any> & { as: GetAs }
type Schema = Record<string, AnyOptions>
type RawAll = Record<string, string | string[]>

function toArray(v: LocationQueryValue | LocationQueryValue[] | undefined): string[] | undefined {
  if (v == null) return undefined
  const arr = Array.isArray(v) ? v : [v]
  // LocationQueryValue is string | null
  return arr.filter((x): x is string => x != null)
}

function coerceBoolean(raw: string | undefined): boolean | undefined {
  // presence-only flags: ?flag → true
  if (raw === undefined) return undefined
  const s = raw.toLowerCase()
  if (s === '' ) return true
  if (['1','true','yes','on'].includes(s)) return true
  if (['0','false','no','off'].includes(s)) return false
  return undefined
}

export function useQueryParams() {
  const route = useRoute()
  const router = useRouter()
  const queryKey = computed(() => JSON.stringify(route.query))

  function setQueryParam(query: QueryParams) {
    const next: Record<string, any> = { ...route.query, ...query }
    // Clean out undefined to remove keys
    Object.keys(next).forEach(k => next[k] === undefined && delete next[k])

    router.push({
      path: route.path,
      query: next,
    })
  }

  /**
   * Flexible getter:
   * - as:'string'  -> first value or undefined (respects emptyIsUndefined)
   * - as:'number'  -> parsed float or undefined if NaN/empty
   * - as:'boolean' -> true/false for common tokens; ?flag or flag= => true
   * - as:'array'   -> string[] (empty array if missing and default not provided)
   */
  function getQueryParam<T = string>(
    key: string,
    opts: GetOptions<T> = {}
  ): T | undefined {
    const {
      as = 'string',
      emptyIsUndefined = true,
      trim = true,
      default: def,
    } = opts

    const raw = route.query[key] as LocationQuery[keyof LocationQuery]

    if (as === 'array') {
      const arr = toArray(raw)?.map(s => (trim ? s.trim() : s))
      if (!arr || (emptyIsUndefined && arr.length === 0)) {
        return (def as T) ?? ([] as unknown as T)
      }
      return arr as unknown as T
    }

    const first = toArray(raw)?.[0]
    const value = trim && typeof first === 'string' ? first.trim() : first

    if (as === 'string') {
      if (value == null || (emptyIsUndefined && value === '')) return def as T
      return value as unknown as T
    }

    if (as === 'number') {
      if (value == null || (emptyIsUndefined && value === '')) return def as T
      const n = Number(value)
      return Number.isFinite(n) ? (n as unknown as T) : (def as T)
    }

    if (as === 'boolean') {
      // If key is present with no value (?flag) we interpret as true
      const present = key in route.query
      if (!present) return def as T
      const b = coerceBoolean(value ?? '')
      return (b ?? (def as unknown as boolean)) as unknown as T
    }

    return def as T
  }

  /** Convenience helpers */
  const getString = (key: string, def?: string) =>
    getQueryParam<string>(key, { as: 'string', default: def })
  const getNumber = (key: string, def?: number) =>
    getQueryParam<number>(key, { as: 'number', default: def })
  const getBoolean = (key: string, def?: boolean) =>
    getQueryParam<boolean>(key, { as: 'boolean', default: def })
  const getArray = (key: string, def: string[] = []) =>
    getQueryParam<string[]>(key, { as: 'array', default: def, emptyIsUndefined: false })

  function toRawAll(q: LocationQuery, trim = true): RawAll {
    const out: RawAll = {}
    for (const k in q) {
      const arr = toArray(q[k])?.map(s => (trim ? s.trim() : s)) ?? []
      out[k] = arr.length <= 1 ? (arr[0] ?? '') : arr
    }
    return out
  }

  /**
   * Overloads:
   */
  function getAllQueryParams(): RawAll
  function getAllQueryParams<T extends Record<string, any>>(
    schema: Schema,
    opts?: { includeUnknown?: boolean; trimUnknown?: boolean }
  ): T

  function getAllQueryParams(
    schema?: Schema,
    opts?: { includeUnknown?: boolean; trimUnknown?: boolean }
  ): unknown {
    const q = route.query as LocationQuery

    // 1) Không có schema → trả raw (string | string[])
    if (!schema) return toRawAll(q)

    // 2) Có schema → ép kiểu theo từng key
    const result: Record<string, unknown> = {}

    for (const key of Object.keys(schema)) {
      const opt = schema[key]
      // dùng luôn getQueryParam để đảm bảo logic thống nhất
      result[key] = getQueryParam(key, opt as AnyOptions)
    }

    // 3) (tuỳ chọn) gộp các key không có trong schema
    if (opts?.includeUnknown) {
      for (const key in q) {
        if (key in schema) continue
        const rawArr = toArray(q[key]) ?? []
        const arr = (opts?.trimUnknown ?? true) ? rawArr.map(s => s.trim()) : rawArr
        result[key] = arr.length <= 1 ? (arr[0] ?? '') : arr
      }
    }

    return result
  }


  return {
    setQueryParam,
    getQueryParam,
    getString,
    getNumber,
    getBoolean,
    getArray,
    getAllQueryParams,
    toRawAll,
    queryKey
  }
}
