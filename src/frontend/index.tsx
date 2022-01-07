import React from 'react'
import ReactDOM from 'react-dom'
import {BrowserRouter, Routes, Route, Outlet, Link} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from 'react-query'

const App = () => (
  <div>
    <h1>App</h1>
    <nav>
      <Link to='/lol'>Lol2</Link>
      <Link to='/Internet'>Internet</Link>
      <br />
    </nav>
    <Outlet />
  </div>
)

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<App />}>
          <Route path='/lol' element={<div>Lol</div>} />
          <Route path='/internet' element={<div>Internet</div>} />
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
