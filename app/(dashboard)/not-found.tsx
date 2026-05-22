import { NotFoundDisplay } from '@/components/error-display';

export default function DashboardNotFound() {
  return (
    <NotFoundDisplay
      title='Page Not Found'
      description='The page you requested does not exist in the dashboard.'
      backHref='/dashboard'
      backLabel='Go to Dashboard'
    />
  );
}
