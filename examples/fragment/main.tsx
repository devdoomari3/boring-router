import {createBrowserHistory} from 'history';
import {observer} from 'mobx-react';
import React, {Component, ReactNode} from 'react';
import ReactDOM from 'react-dom';

import {Link, Route, RouteMatch, Router} from '../../bld/library';

const history = createBrowserHistory();

const router = Router.create(
  {
    default: {
      $match: '',
    },
    account: {
      $children: {
        id: {
          $match: RouteMatch.fragment,
        },
      },
    },
  },
  history,
);

@observer
export class App extends Component {
  render(): ReactNode {
    return (
      <>
        <h1>Boring Router</h1>
        <Route match={router.default}>
          <p>Home page</p>
          <div>
            <Link to={router.account.id} params={{id: '123'}}>
              Account 123
            </Link>
          </div>
        </Route>
        <Route match={router.account}>
          <p>Account page</p>
          <Link to={router.default}>Home</Link>
          <hr />
          <Route match={router.account.id}>
            <p>Account {router.account.id.$params.id} details page</p>
          </Route>
        </Route>
      </>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
