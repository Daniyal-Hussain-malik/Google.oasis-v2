import React, { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LinearProgress } from '@mui/material';
import { Button } from '@/src/components/ui/button';
import { SiteBackdrop } from '@/src/components/ui/site-backdrop';
import { GuestLayout } from '@/src/components/guest/GuestLayout';
import { StaffRole, SUPER, FRONT, FLOOR, useAdminAuth } from '@/src/context/AdminAuthContext';
import { track } from '@/src/lib/api';
import { applyDocumentSeo } from '@/src/lib/seo';

// Guest Portal Pages
import { HomePage } from '@/src/pages/guest/HomePage';
import { RoomsPage } from '@/src/pages/guest/RoomsPage';
import { BookPage } from '@/src/pages/guest/BookPage';
import { ConfirmationPage } from '@/src/pages/guest/ConfirmationPage';
import { LookupPage } from '@/src/pages/guest/LookupPage';
import { GuestPortalPage } from '@/src/pages/guest/GuestPortalPage';
import { OrderPage } from '@/src/pages/guest/OrderPage';
import {
  ActivitiesPage,
  ContactPage,
  DirectionsPage,
  EventsPage,
  FacilitiesPage,
  FaqPage,
  GalleryPage,
  ReviewsPage,
  TourPage,
  VisitPage,
} from '@/src/pages/guest/ResortPages';
import {
  AboutPage,
  CirclePage,
  DetailPage,
  IndexPage,
  PlainPolicyPage,
  SitemapPage,
  TopicEnquiryPage,
  WellnessPage,
} from '@/src/pages/guest/DiscoverPages';

// Admin & Restaurant Operations Pages
import { AdminLoginPage, AdminResetPasswordPage } from '@/src/pages/admin/AdminLoginPage';
import { AdminDashboardPage } from '@/src/pages/admin/AdminDashboardPage';
import { AdminReservationsPage } from '@/src/pages/admin/AdminReservationsPage';
import {
  AdminEnquiriesPage,
  AdminFeedbackPage,
  AdminPaymentProofsPage,
  AdminRoomTypesPage,
  AdminRoomsPage,
} from '@/src/pages/admin/AdminOperationsPages';
import {
  AdminBlogPage,
  AdminInsightsPage,
  AdminSiteSettingsPage,
  AdminUsersPage,
} from '@/src/pages/admin/AdminWebsitePages';
import {
  RestaurantCategoriesPage,
  RestaurantKitchenPage,
  RestaurantKotsPage,
  RestaurantMenuPage,
  RestaurantOrdersPage,
  RestaurantOverviewPage,
  RestaurantPOSPage,
  RestaurantPaymentsPage,
  RestaurantReportsPage,
} from '@/src/pages/admin/restaurant/AdminRestaurantPages';

function ScrollAndTrack() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    applyDocumentSeo(pathname);
  }, [pathname]);
  return null;
}

function LegalRoute() {
  const { slug } = useParams();
  return <PlainPolicyPage slug={slug || 'terms'} />;
}

function RequireStaff({ roles, children }: { roles: StaffRole[]; children: React.ReactNode }) {
  const { user, ready, can } = useAdminAuth();

  if (!ready) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-64 space-y-3 text-center">
          <p className="font-display text-xl text-foreground">Loading Operations Desk…</p>
          <LinearProgress />
        </div>
      </div>
    );
  }

  if (!user) return <AdminLoginPage />;

  if (!can(...roles)) {
    const fallback = user.role === 'chef' ? '/admin/restaurant/kitchen' : '/admin';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function NotFoundPage() {
  return (
    <GuestLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-5">
        <p className="font-mono text-xs uppercase tracking-wider text-accent">404 · Not Found</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Beyond the Dunes</h1>
        <p className="text-base text-muted-foreground">
          The page you are looking for has moved or does not exist. Explore our desert huts or start a direct booking.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button asChild variant="accent">
            <Link to="/book">Book a Stay</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    </GuestLayout>
  );
}

export default function App() {
  return (
    <>
      <SiteBackdrop />
      <ScrollAndTrack />
      <Routes>
        {/* Public Guest Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/stay" element={<RoomsPage />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/confirmed" element={<ConfirmationPage />} />
        <Route path="/booking" element={<LookupPage />} />
        <Route path="/login" element={<GuestPortalPage />} />
        <Route path="/order" element={<OrderPage />} />

        {/* Resort Guide & Practical Pages */}
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/directions" element={<DirectionsPage />} />
        <Route path="/virtual-tour" element={<TourPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/visit" element={<VisitPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/events" element={<EventsPage />} />

        {/* Discover, Dining, Offers & Journal */}
        <Route path="/around" element={<IndexPage kind="places" />} />
        <Route path="/around/:slug" element={<DetailPage kind="places" />} />
        <Route path="/lahore" element={<Navigate to="/around" replace />} />
        <Route path="/lahore/:slug" element={<Navigate to="/around" replace />} />
        <Route path="/experiences" element={<IndexPage kind="experiences" />} />
        <Route path="/experiences/:slug" element={<DetailPage kind="experiences" />} />
        <Route path="/offers" element={<IndexPage kind="offers" />} />
        <Route path="/offers/:slug" element={<DetailPage kind="offers" />} />
        <Route path="/dining" element={<IndexPage kind="restaurants" />} />
        <Route path="/dining/:slug" element={<DetailPage kind="restaurants" />} />
        <Route path="/blog" element={<IndexPage kind="journals" />} />
        <Route path="/blog/:slug" element={<DetailPage kind="journals" />} />
        <Route path="/journal" element={<IndexPage kind="journals" />} />
        <Route path="/journal/:slug" element={<DetailPage kind="journals" />} />

        {/* Brand & Special Enquiry Pages */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/wellness" element={<WellnessPage />} />
        <Route
          path="/weddings"
          element={
            <TopicEnquiryPage
              topic="Wedding"
              title="Huts together, the kitchen for your table."
              desc="A small wedding or family gathering in the desert: write to the desk with how many people, and the dates."
              prompt="How many huts, which month, and whether you want dinner on the sand."
            />
          }
        />
        <Route
          path="/meetings"
          element={
            <TopicEnquiryPage
              topic="Meeting"
              title="A quiet week to get through real work."
              desc="Bring a small team out of town. Wi-Fi, the window seats, breakfast, and dinner on one bill."
              prompt="How many people, how many nights, and when."
            />
          }
        />
        <Route
          path="/gifts"
          element={
            <TopicEnquiryPage
              topic="Gift stay"
              title="A stay to give, not a plastic card."
              desc="Name the nights or an amount, and the desk writes the note for the people coming."
              prompt="Who is it for, and when might they travel?"
            />
          }
        />
        <Route path="/circle" element={<CirclePage />} />
        <Route
          path="/careers"
          element={
            <TopicEnquiryPage
              topic="Career"
              title="The desk, the kitchen, the house."
              desc="We hire for the front desk, housekeeping, and the kitchen. Write with the role you want. There is no portal."
              prompt="Which department, and a line about where you have worked."
            />
          }
        />
        <Route
          path="/press"
          element={
            <TopicEnquiryPage
              topic="Press"
              title="Facts, if you are writing about the resort."
              desc="Nineteen rooms on the Katpana cold desert, Skardu. Breakfast included. For a visit or a photograph, write first."
              prompt="What are you writing, and when do you need an answer?"
            />
          }
        />
        <Route
          path="/partners"
          element={
            <TopicEnquiryPage
              topic="Partnership"
              title="Drivers, and the lake run."
              desc="We work with a small list of Skardu drivers for the airport and for Shangrila. If that is you, introduce yourself. We do not join loyalty coalitions or card schemes."
              prompt="What do you do, and how would a guest meet you?"
            />
          }
        />

        <Route path="/sitemap" element={<SitemapPage />} />
        <Route path="/legal/:slug" element={<LegalRoute />} />
        <Route path="/privacy" element={<PlainPolicyPage slug="privacy" />} />
        <Route path="/terms" element={<PlainPolicyPage slug="terms" />} />
        <Route path="/refund-policy" element={<PlainPolicyPage slug="refund" />} />

        {/* Staff & Admin Portal Routes */}
        <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
        <Route
          path="/admin"
          element={
            <RequireStaff roles={FRONT}>
              <AdminDashboardPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/reservations"
          element={
            <RequireStaff roles={FRONT}>
              <AdminReservationsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/payment-proofs"
          element={
            <RequireStaff roles={FRONT}>
              <AdminPaymentProofsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/enquiries"
          element={
            <RequireStaff roles={FRONT}>
              <AdminEnquiriesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/feedback"
          element={
            <RequireStaff roles={FRONT}>
              <AdminFeedbackPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/room-types"
          element={
            <RequireStaff roles={FRONT}>
              <AdminRoomTypesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <RequireStaff roles={FRONT}>
              <AdminRoomsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/blog"
          element={
            <RequireStaff roles={SUPER}>
              <AdminBlogPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/site"
          element={
            <RequireStaff roles={SUPER}>
              <AdminSiteSettingsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/insights"
          element={
            <RequireStaff roles={SUPER}>
              <AdminInsightsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireStaff roles={SUPER}>
              <AdminUsersPage />
            </RequireStaff>
          }
        />

        {/* Restaurant & Kitchen Operations */}
        <Route
          path="/admin/restaurant"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantOverviewPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/pos"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantPOSPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/orders"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantOrdersPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/kots"
          element={
            <RequireStaff roles={FLOOR}>
              <RestaurantKotsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/kitchen"
          element={
            <RequireStaff roles={FLOOR}>
              <RestaurantKitchenPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/menu"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantMenuPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/categories"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantCategoriesPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/payments"
          element={
            <RequireStaff roles={FRONT}>
              <RestaurantPaymentsPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin/restaurant/reports"
          element={
            <RequireStaff roles={SUPER}>
              <RestaurantReportsPage />
            </RequireStaff>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
