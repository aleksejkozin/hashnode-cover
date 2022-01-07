import React from 'react'
import ReactDOM from 'react-dom'
import {BrowserRouter, Outlet, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from 'react-query'
import {FeatureArticles} from './FeatureArticles'

const App = () => (
  <div style={{width: '500px', margin: 'auto'}}>
    <h1>Hashnode Cover</h1>
    <Outlet />
  </div>
)

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path='/' element={<FeatureArticles />} />
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
