import { AppLayout, adminNavItems } from './AppLayout';

export const AdminLayout = ({ title, children }) => {
  return (
    <AppLayout title={title} navItems={adminNavItems}>
      {children}
    </AppLayout>
  );
};
