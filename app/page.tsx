// app/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function App() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/home');
  } else {
    redirect('/login');
  }
}
