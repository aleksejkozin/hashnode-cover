import React from 'react'
import ReactDOM from 'react-dom'
import {BrowserRouter, Link, Outlet, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from 'react-query'
import {FeatureArticles} from './FeatureArticles'
import {FeatureConnections} from './FeatureConnections'

const App = () => (
  <div style={{width: '500px', margin: 'auto'}}>
    <Link to='/'>
      <h1>Hashnode Cover</h1>
    </Link>
    <Outlet />
  </div>
)

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path='/' element={<FeatureArticles />} />
          <Route path='/connections' element={<FeatureConnections />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const queryClient = new QueryClient()

ReactDOM.render(
  <QueryClientProvider client={queryClient}>
    <Router />
  </QueryClientProvider>,
  document.getElementById('app'),
)
