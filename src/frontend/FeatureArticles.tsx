import React from 'react'
import {useMutation, useQuery, useQueryClient} from 'react-query'
import axios from 'axios'
import {Form} from '../common/ui/Form'

const useUser = () =>
  useQuery('user', () => axios.get('/api/user').then(res => res.data))

function HashnodeConnection() {
  const {invalidateQueries} = useQueryClient()
  const onSuccess = () => invalidateQueries('user')

  const {data: user} = useUser()

  const {
    mutateAsync: connectHashnode,
    isLoading: l1,
    error: e1,
  } = useMutation(
    (x: any) =>
      axios.put('/api/user', {
        connections: {hashnode: x},
      }),
    {onSuccess},
  )

  const {
    mutateAsync: disconnectHashnode,
    isLoading: l2,
    error: e2,
  } = useMutation(
    () =>
      axios.put('/api/user', {
        connections: {hashnode: undefined},
      }),
    {onSuccess},
  )

  const isLoading = l1 || l2
  const error = e1 || e2
  const isSet = user?.connections?.hashnode !== undefined

  if (error) {
    return (
      <>
        <h2>Something is terrible wrong</h2>
        <p>{JSON.stringify(error)}</p>
      </>
    )
  }

  return (
    <Form onSubmit={x => (isSet ? disconnectHashnode() : connectHashnode(x))}>
      <fieldset disabled={isLoading}>
        <legend>Hashnode Connection</legend>
        <p>
          Open{' '}
          <a
            target='_blank'
            rel='noreferrer'
            href='https://hashnode.com/settings/developer'
          >
            https://hashnode.com/settings/developer
          </a>{' '}
          and press &quot;Generate&nbsp;New&nbsp;Token&quot;
        </p>
        <hr />
        <label>
          Personal Access Token:
          <br />
          {isSet ? (
            <input
              key='connectedInput'
              type='text'
              disabled={true}
              style={{width: '100%'}}
              value={user?.connections?.hashnode?.token}
            />
          ) : (
            <input
              type='text'
              name='token'
              disabled={isLoading}
              required={true}
              style={{width: '100%'}}
              pattern='\w{8}-\w{4}-\w{4}-\w{4}-\w{12}'
              title='It should look like this: 2d3dc949-94a5-46ed-98b9-c818c0a0fa21'
            />
          )}
        </label>
        <br />
        <button type='submit' disabled={isLoading}>
          {isSet ? 'Disconnect' : 'Connect'}
        </button>
      </fieldset>
    </Form>
  )
}

export function FeatureArticles() {
  const {isLoading, data, error} = useUser()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <>
        <h2>Something is terrible wrong</h2>
        <p>{JSON.stringify(error)}</p>
      </>
    )
  }

  return (
    <div>
      <p>Hello {data?.name}!</p>
      <HashnodeConnection />
    </div>
  )
}
