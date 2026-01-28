import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          hd: "menatransport.co.th", 
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ account , profile } : { account: any, profile?: any }) {
      // console.log('account : ', account);
      // console.log('profile : ', profile);
      return true 
    },
    async jwt({ token, account }) {
      if (account) {
        token.id_token = account.id_token;
        token.access_token = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      session.id_token = token.id_token;
      session.access_token = token.access_token;
      return session;
    },
  },
})

export { handler as GET, handler as POST }
