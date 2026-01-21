import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        //   hd: "menatransport.co.th", 
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ account , profile } : { account: any, profile?: any }) {
    //   if (account?.provider === "google") {
    //     return profile?.email?.endsWith("@menatransport.co.th") ?? false
    //   }
      console.log('Account : ', account);
      return true 
    },
  },
})

export { handler as GET, handler as POST }
