import { NotFoundDisplay } from '@/components/error-display';

export default function PublicNotFound() {
  return (
    <NotFoundDisplay
      title='Page Not Found'
      description="The page you're looking for doesn't exist."
      backHref='/'
      backLabel='Go Home'
    />
  );
}
