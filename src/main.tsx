import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { ReviewLinkPage } from './components/reviews/ReviewLinkPage';
import { ReviewLookupPage } from './components/reviews/ReviewLookupPage';
import './index.css';

// /review/<token> is a standalone page for the emailed review link (no storefront shell, no login).
const reviewMatch = window.location.pathname.match(/^\/review\/([A-Za-z0-9_-]{30,80})\/?$/);
const isReviewLookup = /^\/review\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    {reviewMatch ? <ReviewLinkPage token={reviewMatch[1]} /> : isReviewLookup ? <ReviewLookupPage /> : <App />}
  </AppErrorBoundary>
);
