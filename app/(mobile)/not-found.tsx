import { NotFoundDisplay } from '@/components/error-display';

export default function MobileNotFound() {
  return (
    <NotFoundDisplay
      title='Page Not Found'
      description="This page doesn't exist."
      backHref='/m'
      backLabel='Go Home'
    />
  );
}
