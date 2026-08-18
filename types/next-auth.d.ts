import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'CUSTOMER' | 'ADMIN'
    } & DefaultSession['user']
  }

  // Augment the User object so it has 'role' available in jwt() callback
  interface User {
    role?: 'CUSTOMER' | 'ADMIN'
    rememberMe?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'CUSTOMER' | 'ADMIN'
    rememberMe?: boolean
  }
}
