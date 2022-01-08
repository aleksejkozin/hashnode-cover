import React from 'react'
import {useUser, useUserMutation} from './useUser'
import {sortBy} from 'lodash'
import {Link} from 'react-router-dom'

function Article({title, coverImage, slug, connected}: any) {
  const {mutateAsync, isLoading, error}: any = useUserMutation()

  const toggle = () =>
    mutateAsync({
      articles: {
        [slug]: {
          connected: !connected,
        },
      },
    })

  return (
    <>
      <a
        target='_blank'
        rel='noreferrer'
        href={'https://aleksey.hashnode.dev/' + slug}
      >
        <img
          src={coverImage}
          alt={title}
          style={{
            width: '100%',
            objectFit: 'cover',
            maxHeight: '300px',
          }}
        />
        <h2>{title}</h2>
      </a>
      {connected && <p>Status: Connected</p>}
      {error && <p style={{color: 'red'}}>Error: {error?.message}</p>}
      <button type='button' onClick={toggle} disabled={isLoading}>
        {connected ? 'Disable' : 'Enable'}
      </button>
      <hr />
    </>
  )
}

export function Articles() {
  const {data} = useUser()

  const articles = sortBy(
    Object.values(data.articles).filter((x: any) => x.title),
    x => new Date(x.dateAdded),
  )

  const isConnected = data?.connections?.hashnode !== undefined

  if (!isConnected) {
    return (
      <p>
        You are not connected to any blogging platform. Please,{' '}
        <Link to='/connections'>configure your connection</Link>.
      </p>
    )
  }

  return (
    <div>
      {articles.map(x => (
        <Article key={x.slug} {...x} />
      ))}
    </div>
  )
}
