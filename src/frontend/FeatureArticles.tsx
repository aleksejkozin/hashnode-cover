import React from 'react'
import {useUser} from './useUser'
import {Articles} from './Articles'
import {Link} from 'react-router-dom'

export function FeatureArticles() {
  const {isLoading, data, error} = useUser()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <>
        <h2>Error</h2>
        <p>{JSON.stringify(error)}</p>
      </>
    )
  }

  return (
    <div>
      <p>Hello {data?.name}!</p>
      <Link to='/connections'>Configure connection</Link>
      <br />
      <br />
      <br />
      <Articles />
    </div>
  )
}
