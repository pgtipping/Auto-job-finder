// LoginForm: User login form
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { register, handleSubmit, formState } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });
  const onSubmit = (data: LoginData) => {
    // TODO: Implement authentication logic (API call)
  };
  return (
    <Card className="w-full max-w-md p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-lg font-semibold mb-2">Login</h2>
        <Input {...register('email')} placeholder="Email" type="email" />
        <Input {...register('password')} placeholder="Password" type="password" />
        <Button type="submit" className="w-full">Login</Button>
      </form>
    </Card>
  );
}
