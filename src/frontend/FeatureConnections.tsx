import React from 'react'
import {HashnodeConnection} from './HashnodeConnection'
import {useUser} from './useUser'

export function FeatureConnections() {
  const {isLoading} = useUser()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <h2>Connection configurations</h2>
      <p>Here you can configure your connections to blogging platforms</p>
      <br />
      <HashnodeConnection />
    </>
  )
}
