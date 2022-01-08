import axios from 'axios'

/*
There is no API that gives your username
Thus implementation kinda sucks
To get your username you need to:
- create an empty post
- extract the username
- and delete the post
*/
export const getHashnodeUsername = async (token: string) => {
  const createQuery = `
    mutation {
      createStory(input: {
        title: "Test hashnode connection",
        contentMarkdown: "Tested",
        tags: []
      }) {
        post {
          _id
          author {
            username
          }
        }
      }
    }
  `
  const {
    data: {
      data: {
        createStory: {
          post: {
            _id,
            author: {username},
          },
        },
      },
    },
  } = await axios.post(
    'https://api.hashnode.com',
    {
      query: createQuery,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    },
  )

  const deleteQuery = `
    mutation {
      deletePost(id: "${_id}") {
        code
        success
      }
    }
  `
  await axios.post(
    'https://api.hashnode.com',
    {
      query: deleteQuery,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    },
  )

  return username
}

export const getHashnodeArticles = async (
  token: string,
  username: string,
  page: number = 0,
) => {
  const query = `
   {
    user(username: "${username}") {
      publication {
        posts(page: ${page}) {
          title
          coverImage
          slug
          dateAdded
        }
      }
    }
  }
  `

  const {
    data: {
      data: {
        user: {
          publication: {posts},
        },
      },
    },
  } = await axios.post(
    'https://api.hashnode.com',
    {query},
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    },
  )

  return posts
}
