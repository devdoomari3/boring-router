import {History} from 'history';
import {autorun, observable} from 'mobx';
import {Dict} from 'tslang';

import {isPathPrefix} from './@utils';

export type RouteMatchAction = () => void;

interface RouteMatchInternalResult {
  current: string | undefined;
  rest: string;
}

export type GeneralFragmentDict = Dict<string | undefined>;
export type GeneralQueryDict = Dict<string | undefined>;
export type GeneralParamDict = Dict<string | undefined>;

/** @internal */
export interface RouteMatchPushResult {
  matched: boolean;
  rest: string;
  pathFragmentDict: GeneralFragmentDict;
  paramFragmentDict: GeneralFragmentDict;
}

export interface RouteMatchOptions {
  match: string | RegExp;
  query: Dict<boolean> | undefined;
}

export class RouteMatch<
  TParamDict extends GeneralParamDict = GeneralParamDict
> {
  /**
   * Name of this `RouteMatch`, correspondent to the field name of route
   * schema.
   */
  readonly $name: string;

  /** @internal */
  private _history: History;

  /** @internal */
  private _matchPattern: string | RegExp;

  /** @internal */
  private _queryKeys: string[] | undefined;

  /** @internal */
  @observable
  private _matched = false;

  /** @internal */
  @observable
  private _exact = false;

  /** @internal */
  private _pathFragments!: GeneralFragmentDict;

  /** @internal */
  private _sourceQuery!: GeneralQueryDict;

  /** @internal */
  @observable
  private _params!: GeneralParamDict;

  /** @internal */
  _children!: RouteMatch[];

  constructor(
    name: string,
    history: History,
    {match, query}: RouteMatchOptions,
  ) {
    this.$name = name;
    this._history = history;

    if (match instanceof RegExp && match.global) {
      throw new Error(
        'Expecting a non-global regular expression as match pattern',
      );
    }

    this._matchPattern = match;

    if (query) {
      this._queryKeys = Object.keys(query);
    }
  }

  /**
   * A reactive value indicates whether this route is matched.
   */
  get $matched(): boolean {
    return this._matched;
  }

  /**
   * A reactive value indicates whether this route is exactly matched.
   */
  get $exact(): boolean {
    return this._exact;
  }

  /**
   * A dictionary of the combination of query string and fragments.
   */
  get $params(): TParamDict {
    return this._params as TParamDict;
  }

  /**
   * Generates a string reference that can be used for history navigation.
   * @param params A dictionary of the combination of query string and
   * fragments.
   * @param preserveQuery Whether to preserve values in current query string.
   */
  $ref(params: Partial<TParamDict> = {}, preserveQuery = false): string {
    let fragmentDict = this._pathFragments;

    let paramKeySet = new Set(Object.keys(params));

    let path = Object.keys(fragmentDict)
      .map(key => {
        paramKeySet.delete(key);

        let param = params[key];
        let fragment = typeof param === 'string' ? param : fragmentDict[key];

        if (typeof fragment !== 'string') {
          throw new Error(`Parameter "${key}" is required`);
        }

        return `/${fragment}`;
      })
      .join('');

    let sourceQueryDict = this._sourceQuery;

    let query = new URLSearchParams([
      ...(preserveQuery
        ? (Object.entries(sourceQueryDict) as [string, string][])
        : []),
      ...Array.from(paramKeySet).map(
        (key): [string, string] => [key, params[key]!],
      ),
    ]).toString();

    return path + (query ? `?${query}` : '');
  }

  /**
   * Perform a `history.push()` with `this.$ref(params, preserveQuery)`.
   */
  $push(params?: Partial<TParamDict>, preserveQuery?: boolean): void {
    let ref = this.$ref(params, preserveQuery);
    this._history.push(ref);
  }

  /**
   * Perform a `history.replace()` with `this.$ref(params, preserveQuery)`.
   */
  $replace(params?: Partial<TParamDict>, preserveQuery?: boolean): void {
    let ref = this.$ref(params, preserveQuery);
    this._history.replace(ref);
  }

  /**
   * Perform an action if this `RouteMatch` matches.
   * @param action A callback to perform this action.
   * @param exact Perform this action only if it's an exact match.
   */
  $action(action: RouteMatchAction, exact = false): void {
    autorun(() => {
      if (exact ? this.$exact : this.$matched) {
        requestAnimationFrame(() => action());
      }
    });
  }

  /** @internal */
  _update(
    skipped: boolean,
    upperRest: string,
    upperPathFragmentDict: GeneralFragmentDict,
    upperParamFragmentDict: GeneralFragmentDict,
    sourceQueryDict: GeneralQueryDict,
  ): RouteMatchPushResult {
    let {current, rest} = this._match(skipped, upperRest);

    let name = this.$name;

    let matched = current !== undefined;
    let exact = matched && rest === '';

    let matchPattern = this._matchPattern;

    let pathFragmentDict = {
      ...upperPathFragmentDict,
      ...{[name]: typeof matchPattern === 'string' ? matchPattern : current},
    };

    let paramFragmentDict = {
      ...upperParamFragmentDict,
      ...(typeof matchPattern === 'string' ? undefined : {[name]: current}),
    };

    this._pathFragments = pathFragmentDict;

    let queryKeys = this._queryKeys;

    let queryDict = queryKeys
      ? matched
        ? queryKeys.reduce(
            (dict, key) => {
              let value = sourceQueryDict[key];

              if (value !== undefined) {
                dict[key] = sourceQueryDict[key];
              }

              return dict;
            },
            {} as GeneralQueryDict,
          )
        : {}
      : undefined;

    this._sourceQuery = sourceQueryDict;

    this._params = {
      ...paramFragmentDict,
      ...queryDict,
    };

    this._matched = matched;
    this._exact = exact;

    return {
      matched,
      rest,
      pathFragmentDict,
      paramFragmentDict,
    };
  }

  /** @internal */
  private _match(skipped: boolean, rest: string): RouteMatchInternalResult {
    if (skipped || !rest) {
      return {
        current: undefined,
        rest: '',
      };
    }

    if (!rest.startsWith('/')) {
      throw new Error(
        `Expecting rest of path to be started with "/", but got ${JSON.stringify(
          rest,
        )} instead`,
      );
    }

    rest = rest.slice(1);

    let pattern = this._matchPattern;

    if (typeof pattern === 'string') {
      if (isPathPrefix(rest, pattern)) {
        return {
          current: pattern,
          rest: rest.slice(pattern.length),
        };
      } else {
        return {
          current: undefined,
          rest: '',
        };
      }
    } else {
      let groups = pattern.exec(rest);

      if (groups) {
        let matched = groups[0];

        if (!isPathPrefix(rest, matched)) {
          throw new Error(
            `Invalid regular expression pattern, expecting rest of path to be started with "/" after match (matched ${JSON.stringify(
              matched,
            )} out of ${JSON.stringify(rest)})`,
          );
        }

        return {
          current: matched,
          rest: rest.slice(matched.length),
        };
      } else {
        return {
          current: undefined,
          rest: '',
        };
      }
    }
  }

  static fragment = /[^/]+/;
  static rest = /.+/;
}
