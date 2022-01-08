import {Form} from '../common/ui/Form'
import React from 'react'
import {useUser, useUserMutation} from './useUser'

export function HashnodeConnection() {
  const {data: user} = useUser()
  const {mutateAsync, isLoading, error}: any = useUserMutation()

  const isConnected = user?.connections?.hashnode !== undefined

  const toggleConnection = (form: any) =>
    mutateAsync({
      connections: {hashnode: isConnected ? undefined : form},
    })

  return (
    <Form onSubmit={toggleConnection}>
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
          {isConnected ? (
            <input
              key='filledToken'
              type='text'
              disabled={true}
              style={{width: '100%'}}
              value='*****'
            />
          ) : (
            <input
              type='text'
              name='token'
              disabled={isLoading}
              required={true}
              style={{width: '100%'}}
              pattern='\w{8}-\w{4}-\w{4}-\w{4}-\w{12}'
              placeholder='000000-0000-0000-0000-0000000'
              title='It should look like this: 2d3dc949-94a5-46ed-98b9-c818c0a0fa21'
            />
          )}
        </label>
        <br />
        <br />
        {error && <p style={{color: 'red'}}>Error: {error?.message}</p>}
        <button type='submit' disabled={isLoading}>
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
        {isLoading && <p>Loading...</p>}
      </fieldset>
    </Form>
  )
}
