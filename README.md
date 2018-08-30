# Boring Router

A light-weight yet reactive router service using MobX.

## Installation

```sh
# peer dependencies
yarn add history react mobx mobx-react

# boring router package
yarn add boring-router
```

## Usage

```tsx
import {Route, Router} from 'boring-router';
import {observer} from 'mobx-react';
import {createBrowserHistory} from 'history';
import React, {Component} from 'react';

const history = createBrowserHistory();

const router = Router.create(
  {
    account: true,
    about: true,
    notFound: {
      $match: '**',
    },
  },
  history,
);

@observer
class App extends Component {
  render() {
    return (
      <>
        <Route match={router.account}>Account page</Route>
        <Route match={router.about}>About page</Route>
        <Route match={router.notFound}>Not found</Route>
      </>
    );
  }
}
```

## Schema

Boring Router defines routes via a tree-structure schema:

```ts
type RouteSchemaDict = Dict<RouteSchema | boolean>;

interface RouteSchema {
  $match?: string | RegExp;
  $query?: Dict<boolean>;
  $children?: Dict<RouteSchema | boolean>;
}

const schema: RouteSchemaDict = {};
```

> Option `$match` with value `'*'` and `'**'` will be converted to regular expressions `/[^/]+/` and `/.+/` respectively.

## Route match

The value of expression like `router.account` in the usage example above is a `RouteMatch`, and it has the following reactive properties and methods:

```ts
interface RouteMatch<TFragmentDict, TQueryDict> {
  $matched: boolean;
  $exact: boolean;
  $fragments: TFragmentDict;
  $query: TQueryDict;

  $path(
    params?: Partial<TFragmentDict & TQueryDict>,
    preserveQuery?: boolean,
  ): string;
}
```

## Examples

### Example list

- [Basic](examples/basic/main.tsx)

  Basic usage.

  ```tsx
  <Route match={router.account}>
    <p>Account page</p>
    <Link to={router.default.$path()}>Home</Link>
  </Route>
  ```

- [Exact](examples/exact/main.tsx)

  Match exact path.

  ```tsx
  <Route match={router.account} exact>
    <p>Exact account page</p>
    <Link to={router.account.details.$path()}>Account details</Link>
  </Route>
  ```

- [Fragment](examples/fragment/main.tsx)

  Boring Router's version of `/account/:id` alike parameter.

  ```tsx
  <Route match={router.account.id}>
    <p>Account {router.account.id.$fragments.id} details page</p>
  </Route>
  ```

- [Query](examples/query/main.tsx)

  Handle query string parameter.

  ```tsx
  <Route match={router.account}>
    <p>Account {router.account.$query.id} details page</p>
  </Route>
  ```

- [Route Component](examples/route-component/main.tsx)

  Use `<Route />` with a route component.

  ```tsx
  <Route match={router.account} component={AccountPage} />
  ```

- [Link](examples/link/main.tsx)

  Write a useful `<Link>`.

  ```tsx
  <Link to={router.account.id} params={{id: '123'}}>
    Account 123
  </Link>
  ```

### Run an example

```sh
yarn install
yarn build

yarn global add parcel

parcel examples/[name]/index.html
```

## License

MIT License.
