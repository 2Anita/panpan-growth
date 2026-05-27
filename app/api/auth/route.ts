import { NextRequest, NextResponse } from 'next/server';
import { signInAnonymously, signInWithEmail, signUpWithEmail, signOut, getCurrentUser } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const { action, email, password } = await request.json();

    switch (action) {
      case 'anonymous':
        const { user: anonUser, error: anonError } = await signInAnonymously();
        if (anonError) {
          return NextResponse.json({ error: anonError.message }, { status: 400 });
        }
        return NextResponse.json({ user: anonUser, message: 'Anonymous login successful' });

      case 'login':
        if (!email || !password) {
          return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }
        const { user: loginUser, error: loginError } = await signInWithEmail(email, password);
        if (loginError) {
          return NextResponse.json({ error: loginError.message }, { status: 400 });
        }
        return NextResponse.json({ user: loginUser, message: 'Login successful' });

      case 'signup':
        if (!email || !password) {
          return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }
        const { user: signupUser, error: signupError } = await signUpWithEmail(email, password);
        if (signupError) {
          return NextResponse.json({ error: signupError.message }, { status: 400 });
        }
        return NextResponse.json({ user: signupUser, message: 'Signup successful' });

      case 'logout':
        const { error: logoutError } = await signOut();
        if (logoutError) {
          return NextResponse.json({ error: logoutError.message }, { status: 400 });
        }
        return NextResponse.json({ message: 'Logout successful' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ user: null });
  }
}