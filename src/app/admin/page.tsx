import { redirect } from 'next/navigation';

export default function AdminIndex() {
  // Redirect to login page for now
  redirect('/admin/login');
}
