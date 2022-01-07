import React, {FormHTMLAttributes} from 'react'

export const Form = (
  props: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
    onSubmit?: (params: Record<string, any>) => any
  },
) => (
  <form
    {...props}
    onSubmit={(event: any) => {
      event.preventDefault()
      const data = new FormData(event.target)
      // @ts-ignore
      props.onSubmit?.(Object.fromEntries([...data]))
    }}
  />
)
