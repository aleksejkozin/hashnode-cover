import {useMutation, useQuery, useQueryClient} from 'react-query'
import axios from 'axios'

export const useUser = () =>
  useQuery('user', () => axios.get('/api/user').then(res => res.data))

export const useUserMutation = () => {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries('user')
  return useMutation((x: any) => axios.put('/api/user', x), {onSuccess})
}
