import {observable} from 'mobx';
import {OmitValueOfKey, OmitValueWithType} from 'tslang';

import {testPathPrefix, tolerate} from '../@utils';
import {IHistory} from '../history';

import {NextRouteMatch} from './next-route-match';
import {
  COMPATIBLE_MATCH_SYMBOL,
  GeneralParamDict,
  GeneralQueryDict,
  GeneralSegmentDict,
  RouteMatchShared,
  RouteMatchSharedOptions,
} from './route-match-shared';

/**
 * Route before enter callback.
 * @return Return `true` or `undefined` to do nothing; return `false` to revert
 * this history change; return full path to redirect.
 */
export type RouteBeforeEnterCallback<
  TRouteMatch extends RouteMatch = RouteMatch
> = (next: TRouteMatch['$next']) => Promise<boolean | void> | boolean | void;

/**
 * Route before update callback.
 * @return Return `true` or `undefined` to do nothing; return `false` to revert
 * this history change; return full path to redirect.
 */
export type RouteBeforeUpdateCallback<
  TRouteMatch extends RouteMatch = RouteMatch
> = (
  next: TRouteMatch['$next'],
  options: RouteBeforeUpdateCallbackOptions,
) => Promise<boolean | void> | boolean | void;

export interface RouteBeforeUpdateCallbackOptions {
  descendants: boolean;
}

export interface RouteBeforeUpdate<
  TRouteMatch extends RouteMatch = RouteMatch
> {
  options?: RouteBeforeUpdateOptions;
  callback: RouteBeforeUpdateCallback<TRouteMatch>;
}

export interface RouteBeforeUpdateOptions {
  traceDescendants: boolean;
}

/**
 * Route before leave callback.
 * @return Return `true` or `undefined` to do nothing; return `false` to revert
 * this history change.
 */
export type RouteBeforeLeaveCallback = () =>
  | Promise<boolean | void>
  | boolean
  | void;

export type RouteAfterEnterCallback = () => void;

/**
 * Route after update callback.
 */
export type RouteAfterUpdateCallback = (
  options: RouteBeforeUpdateCallbackOptions,
) => void;

export interface RouteBeforeUpdateCallbackOptions {
  descendants: boolean;
}

export interface RouteAfterUpdate {
  options?: RouteAfterUpdateOptions;
  callback: RouteAfterUpdateCallback;
}

export interface RouteAfterUpdateOptions {
  traceDescendants: boolean;
}

export type RouteAfterLeaveCallback = () => void;

export type RouteHookRemovalCallback = () => void;

export type RouteInterceptCallback<
  TRouteMatch extends RouteMatch = RouteMatch
> = (next: TRouteMatch['$next']) => Promise<boolean | void> | boolean | void;

export interface RouteInterceptOptions {
  traceDescendants: boolean;
}

export type RouteReactCallback = () => void;

export type RouteServiceFactory<TRouteMatch extends RouteMatch> = (
  match: TRouteMatch,
) => IRouteService<TRouteMatch> | Promise<IRouteService<TRouteMatch>>;

export interface RouteServiceOptions {
  traceDescendants?: boolean;
}

export type IRouteService<TRouteMatch extends RouteMatch = RouteMatch> = {
  beforeEnter?: RouteBeforeEnterCallback<TRouteMatch>;
  afterEnter?: RouteAfterEnterCallback;
  beforeUpdate?: RouteBeforeUpdate<TRouteMatch>['callback'];
  afterUpdate?: RouteAfterUpdate['callback'];
  beforeLeave?: RouteBeforeLeaveCallback;
  afterLeave?: RouteAfterLeaveCallback;
} & RouteServiceExtension<TRouteMatch>;

export type RouteServiceExtension<
  TRouteMatch extends RouteMatch
> = OmitValueWithType<
  OmitValueOfKey<TRouteMatch, keyof RouteMatch>,
  RouteMatch,
  false
>;

interface RouteMatchInternalResult {
  matched: boolean;
  exactlyMatched: boolean;
  segment: string | undefined;
  rest: string;
}

export interface RouteMatchParallelOptions<TGroupName extends string> {
  groups?: TGroupName[];
  matches?: RouteMatch[];
}

/** @internal */
export interface RouteMatchUpdateResult {
  pathSegmentDict: GeneralSegmentDict;
  paramSegmentDict: GeneralSegmentDict;
}

export interface RouteMatchEntry {
  match: RouteMatch;
  exact: boolean;
  segment: string;
  rest: string;
}

export interface RouteSource {
  groupToMatchToMatchEntryMapMap: Map<
    string | undefined,
    Map<RouteMatch, RouteMatchEntry>
  >;
  queryDict: GeneralQueryDict;
  pathMap: Map<string | undefined, string>;
}

export interface RouteMatchOptions extends RouteMatchSharedOptions {
  exact: boolean;
}

export class RouteMatch<
  TParamDict extends GeneralParamDict = GeneralParamDict,
  TNextRouteMatch extends NextRouteMatch<TParamDict> = NextRouteMatch<
    TParamDict
  >,
  TGroupName extends string = string,
  TGroupNames extends string = string
> extends RouteMatchShared<TParamDict, TGroupName, TGroupNames> {
  readonly $parent: RouteMatch | undefined;

  readonly $next!: TNextRouteMatch;

  /** @internal */
  private _beforeEnterCallbackSet = new Set<RouteBeforeEnterCallback>();

  /** @internal */
  private _beforeUpdateEntrySet = new Set<RouteBeforeUpdate>();

  /** @internal */
  private _beforeLeaveCallbackSet = new Set<RouteBeforeLeaveCallback>();

  /** @internal */
  private _afterEnterCallbackSet = new Set<RouteAfterEnterCallback>();

  /** @internal */
  private _afterUpdateCallbackSet = new Set<RouteAfterUpdate>();

  /** @internal */
  private _afterLeaveCallbackSet = new Set<RouteAfterLeaveCallback>();

  /** @internal */
  @observable
  private _service: IRouteService | undefined;

  /** @internal */
  private _servicePromise: Promise<IRouteService | undefined> | undefined;

  /** @internal */
  private _serviceFactory: RouteServiceFactory<any> | undefined;

  /** @internal */
  private _allowExact: boolean;

  /** @internal */
  _children: RouteMatch[] | undefined;

  /** @internal */
  _parallel: RouteMatchParallelOptions<TGroupName> | undefined;

  constructor(
    name: string,
    prefix: string,
    source: RouteSource,
    parent: RouteMatch | undefined,
    extension: object,
    history: IHistory,
    {exact, ...sharedOptions}: RouteMatchOptions,
  ) {
    super(name, prefix, source, parent, history, sharedOptions);

    for (let [key, defaultValue] of Object.entries(extension)) {
      Object.defineProperty(this, key, {
        get() {
          let service = (this as RouteMatch).$matched
            ? (this as RouteMatch)._service
            : undefined;
          return service ? (service as any)[key] : defaultValue;
        },
      });
    }

    this._allowExact = exact;
  }

  $beforeEnter(
    callback: RouteBeforeEnterCallback<this>,
  ): RouteHookRemovalCallback {
    this._beforeEnterCallbackSet.add(callback as RouteBeforeEnterCallback);

    return () => {
      this._beforeEnterCallbackSet.delete(callback);
    };
  }

  $beforeUpdate(
    callback: RouteBeforeUpdate<this>['callback'],
    options?: RouteBeforeUpdateOptions,
  ): RouteHookRemovalCallback {
    let entity: RouteBeforeUpdate = {
      callback,
      options,
    };

    this._beforeUpdateEntrySet.add(entity);

    return () => {
      this._beforeUpdateEntrySet.delete(entity);
    };
  }

  $beforeLeave(callback: RouteBeforeLeaveCallback): RouteHookRemovalCallback {
    this._beforeLeaveCallbackSet.add(callback);

    return () => {
      this._beforeLeaveCallbackSet.delete(callback);
    };
  }

  $afterEnter(callback: RouteAfterEnterCallback): RouteHookRemovalCallback {
    this._afterEnterCallbackSet.add(callback);

    return () => {
      this._afterEnterCallbackSet.delete(callback);
    };
  }

  $afterUpdate(
    callback: RouteAfterUpdateCallback,
    options?: RouteAfterUpdateOptions,
  ): RouteHookRemovalCallback {
    let afterUpdateEntity: RouteAfterUpdate = {callback, options};

    this._afterUpdateCallbackSet.add(afterUpdateEntity);

    return () => {
      this._afterUpdateCallbackSet.delete(afterUpdateEntity);
    };
  }

  $afterLeave(callback: RouteAfterLeaveCallback): RouteHookRemovalCallback {
    this._afterLeaveCallbackSet.add(callback);

    return () => {
      this._afterLeaveCallbackSet.delete(callback);
    };
  }

  $intercept(
    callback: RouteInterceptCallback,
    options?: RouteInterceptOptions,
  ): RouteHookRemovalCallback {
    this._beforeEnterCallbackSet.add(callback);

    let beforeUpdateEntity: RouteBeforeUpdate = {callback, options};

    this._beforeUpdateEntrySet.add(beforeUpdateEntity);

    return () => {
      this._beforeEnterCallbackSet.delete(callback);
      this._beforeUpdateEntrySet.delete(beforeUpdateEntity);
    };
  }

  $react(
    callback: RouteReactCallback,
    afterUpdateOptions?: RouteAfterUpdateOptions,
  ): RouteHookRemovalCallback {
    let afterUpdateEntity: RouteAfterUpdate = {
      callback,
      options: afterUpdateOptions,
    };

    this._afterEnterCallbackSet.add(callback);
    this._afterUpdateCallbackSet.add(afterUpdateEntity);

    return () => {
      this._afterEnterCallbackSet.delete(callback);
      this._afterUpdateCallbackSet.delete(afterUpdateEntity);
    };
  }

  $service(factory: RouteServiceFactory<this>): this {
    if (this._serviceFactory) {
      throw new Error(`Service has already been defined for "${this.$name}"`);
    }

    this._serviceFactory = factory;

    return this;
  }

  $parallel(options: RouteMatchParallelOptions<TGroupName>): void {
    if (this.$group) {
      throw new Error('Parallel whitelist can only be set on primary routes');
    }

    let {groups = [], matches = []} = options;

    let parent = this.$parent;

    if (parent instanceof RouteMatch && parent._parallel) {
      let {
        groups: parentGroups = [],
        matches: parentMatches = [],
      } = parent._parallel;

      let parentGroupSet = new Set(parentGroups);
      let parentMatchSet = new Set(parentMatches);

      let groupsBeingSubsetOfParents = groups.every(group =>
        parentGroupSet.has(group),
      );

      if (!groupsBeingSubsetOfParents) {
        throw new Error(
          "Parallel group can only be a subset of its parent's groups",
        );
      }

      let matchesBeingSubsetOfParents = matches.every(match => {
        if (
          typeof match.$group === 'string' &&
          parentGroupSet.has(match.$group)
        ) {
          return true;
        }

        let current: RouteMatch | undefined = match;

        while (current) {
          if (parentMatchSet.has(current)) {
            return true;
          }

          current = current.$parent;
        }

        return false;
      });

      if (!matchesBeingSubsetOfParents) {
        throw new Error(
          "Parallel match can only be a subset of its parent's matches",
        );
      }
    }

    this._parallel = options;

    let children = this._children || [];

    for (let child of children) {
      if (
        child._parallel &&
        (!parent || parent._parallel !== child._parallel)
      ) {
        throw new Error(
          'Parallel options can only be specified in a top-down fashion',
        );
      }

      child.$parallel(options);
    }
  }

  /** @internal */
  _match(upperRest: string): RouteMatchInternalResult {
    let segment: string | undefined;
    let rest: string;
    let pattern = this._matchPattern;

    if (typeof pattern === 'symbol') {
      if (pattern === COMPATIBLE_MATCH_SYMBOL) {
        return {
          matched: true,
          exactlyMatched: false,
          segment: undefined,
          rest: upperRest,
        };
      } else {
        throw new Error(`Unrecognized match symbol [${pattern.description}]`);
      }
    }

    if (upperRest) {
      if (!upperRest.startsWith('/')) {
        throw new Error(
          `Expecting rest of path to be started with "/", but got ${JSON.stringify(
            upperRest,
          )} instead`,
        );
      }

      upperRest = upperRest.slice(1);

      if (typeof pattern === 'string') {
        if (testPathPrefix(upperRest, pattern)) {
          segment = pattern;
          rest = upperRest.slice(pattern.length);
        } else {
          segment = undefined;
          rest = '';
        }
      } else {
        let groups = pattern.exec(upperRest);

        if (groups) {
          let matched = groups[0];

          if (testPathPrefix(upperRest, matched)) {
            segment = matched;
            rest = upperRest.slice(matched.length);
          } else {
            segment = undefined;
            rest = '';
          }
        } else {
          segment = undefined;
          rest = '';
        }
      }
    } else {
      segment = undefined;
      rest = '';
    }

    let matched = segment !== undefined;
    let exactlyMatched = matched && rest === '';

    if (exactlyMatched && (this._children && !this._allowExact)) {
      matched = false;
      exactlyMatched = false;
    }

    return {
      matched,
      exactlyMatched,
      segment,
      rest,
    };
  }

  /** @internal */
  async _beforeLeave(): Promise<boolean> {
    let results = await Promise.all([
      ...Array.from(this._beforeLeaveCallbackSet).map(callback =>
        tolerate(callback),
      ),
      (async () => {
        let service = await this._getService();

        if (!service || !service.beforeLeave) {
          return undefined;
        }

        return tolerate(() => service!.beforeLeave!());
      })(),
    ]);

    return !results.some(result => result === false);
  }

  /** @internal */
  async _beforeEnter(): Promise<boolean> {
    let next = this.$next;

    let results = await Promise.all([
      ...Array.from(this._beforeEnterCallbackSet).map(callback =>
        tolerate(callback, next),
      ),
      (async () => {
        let service = await this._getService();

        if (!service || !service.beforeEnter) {
          return undefined;
        }

        return tolerate(() => service!.beforeEnter!(next));
      })(),
    ]);

    return !results.some(result => result === false);
  }

  /** @internal */
  async _beforeUpdate(
    triggerByDescendants: boolean,
  ): Promise<boolean | RouteMatch> {
    let next = this.$next;

    let results = await Promise.all([
      ...Array.from(this._beforeUpdateEntrySet)
        .filter(({options}) =>
          triggerByDescendants ? options && options.traceDescendants : true,
        )
        .map(({callback}) =>
          tolerate(callback, next, {descendants: triggerByDescendants}),
        ),
      (async () => {
        let service = await this._getService();

        if (!service || !service.beforeUpdate) {
          return undefined;
        }

        return tolerate(() =>
          service!.beforeUpdate!(next, {descendants: triggerByDescendants}),
        );
      })(),
    ]);

    return !results.some(result => result === false);
  }

  /** @internal */
  async _afterLeave(): Promise<void> {
    for (let callback of this._afterLeaveCallbackSet) {
      tolerate(callback);
    }

    let service = await this._getService();

    if (!service || !service.afterLeave) {
      return;
    }

    tolerate(() => service!.afterLeave!());
  }

  /** @internal */
  async _afterEnter(): Promise<void> {
    for (let callback of this._afterEnterCallbackSet) {
      tolerate(callback);
    }

    let service = await this._getService();

    if (!service || !service.afterEnter) {
      return;
    }

    tolerate(() => service!.afterEnter!());
  }

  /** @internal */
  async _afterUpdate(triggerByDescendants: boolean): Promise<void> {
    for (let {callback, options} of this._afterUpdateCallbackSet) {
      if (!triggerByDescendants || (options && options.traceDescendants)) {
        tolerate(callback, {descendants: triggerByDescendants});
      }
    }

    let service = await this._getService();

    if (!service || !service.afterUpdate) {
      return;
    }

    tolerate(() => service!.afterUpdate!({descendants: triggerByDescendants}));
  }

  /** @internal */
  _getMatchEntry(source: RouteSource): RouteMatchEntry | undefined {
    let matchToMatchEntryMap = source.groupToMatchToMatchEntryMapMap.get(
      this.$group,
    );

    return matchToMatchEntryMap && matchToMatchEntryMap.get(this);
  }

  /** @internal */
  private async _getService(): Promise<IRouteService | undefined> {
    let serviceOrServicePromise = this._service || this._servicePromise;

    if (serviceOrServicePromise) {
      return serviceOrServicePromise;
    }

    let factory = this._serviceFactory;

    if (!factory) {
      return undefined;
    }

    let output = tolerate(factory, this);

    if (output instanceof Promise) {
      return (this._servicePromise = output.then(service => {
        this._service = service;
        return service;
      }));
    } else {
      this._service = output;
      return output;
    }
  }

  static segment = /[^/]+/;
  static rest = /.+/;
}
