import React from 'react'
import {useMutation, useQuery, useQueryClient} from 'react-query'
import axios from 'axios'
import {UserType} from '../backend/api'
import {Form} from '../common/ui/Form'

const useUser = () =>
  useQuery('user', async () =>
    axios.get('/api/user').then(res => res.data as UserType),
  )

function CreateHashnodeConnection() {
  const queryClient = useQueryClient()

  const {
    isLoading,
    mutateAsync: connectHashnode,
    error,
    isError,
  } = useMutation((x: any) => axios.post('/api/connections/hashnode', x), {
    onSuccess: () => queryClient.invalidateQueries('user'),
  })

  if (isError) {
    return <div>Something is terrible wrong: {JSON.stringify(error)}</div>
  }

  return (
    <Form onSubmit={connectHashnode}>
      <fieldset disabled={isLoading}>
        <legend>Hashnode Connection</legend>
        <label>
          Personal Access Token:
          <br />
          <input type='text' name='token' />
        </label>
        <br />
        <button type='submit' disabled={isLoading}>
          Connect
        </button>
      </fieldset>
    </Form>
  )
}

function ResetHashnodeConnection() {
  const queryClient = useQueryClient()

  const {data: user} = useUser()

  const {
    isLoading,
    mutateAsync: deleteHashnode,
    error,
    isError,
  } = useMutation((x: any) => axios.delete('/api/connections/hashnode', x), {
    onSuccess: () => queryClient.invalidateQueries('user'),
  })

  if (isError) {
    return <div>Something is terrible wrong: {JSON.stringify(error)}</div>
  }

  return (
    <Form onSubmit={deleteHashnode}>
      <fieldset disabled={isLoading}>
        <legend>Hashnode Connection</legend>
        <label>
          Personal Access Token:
          <br />
          <input
            type='text'
            name='token'
            disabled={true}
            value={user?.connections?.hashnode?.token}
          />
        </label>
        <br />
        <button type='submit' disabled={isLoading}>
          Disconnect
        </button>
      </fieldset>
    </Form>
  )
}

function HashnodeConnection() {
  const {data: user} = useUser()

  return user?.connections?.hashnode ? (
    <ResetHashnodeConnection />
  ) : (
    <CreateHashnodeConnection />
  )
}

export function FeatureArticles() {
  const {isLoading, data, isError, error} = useUser()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isError) {
    return <div>Something is terrible wrong: {JSON.stringify(error)}</div>
  }

  return (
    <div>
      <p>Hello {data?.name}!</p>
      <HashnodeConnection />
    </div>
  )
}
