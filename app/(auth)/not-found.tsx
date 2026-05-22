import { NotFoundDisplay } from '@/components/error-display';

export default function AuthNotFound() {
  return (
    <NotFoundDisplay
      title='Page Not Found'
      description='The authentication page you requested does not exist.'
      backHref='/login'
      backLabel='Go to Login'
    />
  );
}
