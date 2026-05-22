import { NotFoundDisplay } from '@/components/error-display';

export default function IndustryPortalNotFound() {
  return (
    <NotFoundDisplay
      title='Page Not Found'
      description='The portal page you requested does not exist.'
      backHref='/industry-portal'
      backLabel='Go to Portal Home'
    />
  );
}
