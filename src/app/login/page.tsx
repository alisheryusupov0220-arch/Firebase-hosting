'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, linkWithCredential } from 'firebase/auth';
import { useAuth } from '@/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Sync custom claims on login
      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/sync-claims', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Ошибка синхронизации прав.');
      }

      // Force refresh token to apply custom claims
      await user.getIdToken(true);

      router.push('/supplies');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Ошибка входа',
        description: error.message,
      });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      let user;
      try {
        const userCredential = await signInWithPopup(auth, provider);
        user = userCredential.user;
      } catch (error: any) {
        if (error.code === 'auth/account-exists-with-different-credential') {
          const credential = GoogleAuthProvider.credentialFromError(error);
          if (!credential || !credential.idToken) {
            throw new Error('Не удалось получить учетные данные Google.');
          }

          const resLink = await fetch('/api/auth/google-login-link', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: credential.idToken }),
          });
          const dataLink = await resLink.json();
          if (!resLink.ok) {
            throw new Error(dataLink.error || 'Ошибка при получении токена связывания.');
          }

          const customUserCredential = await signInWithCustomToken(auth, dataLink.customToken);
          user = customUserCredential.user;

          await linkWithCredential(user, credential);
        } else {
          throw error;
        }
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/auth/sync-claims', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('Ошибка синхронизации прав.');
      }

      await user.getIdToken(true);

      toast({
        title: 'Успешный вход!',
        description: 'Вы вошли через Google.',
      });
      router.push('/supplies');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Ошибка Google-входа',
        description: error.message,
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
       <div className="absolute left-4 top-4">
         <Link href="/" className="flex items-center gap-2 font-headline text-lg font-semibold">
            <Package2 className="h-6 w-6" />
            <span>FLOW Invent+</span>
         </Link>
       </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Вход</CardTitle>
          <CardDescription>
            Введите свой email ниже, чтобы войти в свой аккаунт.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Или</span>
            </div>
          </div>

          <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
            Войти через Google
          </Button>

          <div className="mt-4 text-center text-sm">
            Еще нет аккаунта?{' '}
            <Link href="/register" className="underline">
              Зарегистрироваться
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
