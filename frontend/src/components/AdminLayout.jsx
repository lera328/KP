import { AppLayout, adminNavItems } from './AppLayout';

export const AdminLayout = ({ title, children }) => {
  return (
    <AppLayout
      title={title || 'KiberOne — Администратор'}
      navItems={adminNavItems}
      kidMode
      bottomNav={false}
    >
      {children}
    </AppLayout>
  );
};
