'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'choice' | 'login' | 'signup'>('choice');
  const router = useRouter();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        toast.error('系统未配置，请联系管理员');
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('登录成功');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);
      toast.error('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!supabase) {
        toast.error('系统未配置，请联系管理员');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('登录成功');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);
      toast.error('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!supabase) {
        toast.error('系统未配置，请联系管理员');
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('注册成功，请查收验证邮件');
      setMode('login');
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">登录盘盘成长</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '登录'}
              </Button>
              <div className="text-center text-sm text-gray-500">
                还没有账号？{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-indigo-600 hover:underline"
                >
                  注册
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode('choice')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                返回
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">注册盘盘成长</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="密码（至少6位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '注册'}
              </Button>
              <div className="text-center text-sm text-gray-500">
                已有账号？{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-indigo-600 hover:underline"
                >
                  登录
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode('choice')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                返回
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">盘盘成长</CardTitle>
          <p className="text-center text-gray-500 text-sm mt-2">
            个人成长复盘工具
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-indigo-500 hover:bg-indigo-600"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '登录'
            )}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-50 dark:bg-gray-950 px-2 text-gray-500">或</span>
            </div>
          </div>
          <Button
            onClick={() => setMode('login')}
            variant="outline"
            className="w-full"
          >
            邮箱登录 / 注册
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}