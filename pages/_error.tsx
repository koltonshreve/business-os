import Head from 'next/head';
import Link from 'next/link';
import type { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
  message?: string;
}

export default function ErrorPage({ statusCode, message }: ErrorProps) {
  return (
    <>
      <Head>
        <title>{statusCode ? `${statusCode} Error` : 'Error'} — Business OS</title>
      </Head>
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-[120px] font-bold text-slate-800 leading-none select-none">
            {statusCode ?? '!'}
          </div>
          <h1 className="text-2xl font-semibold text-slate-200 mt-2 mb-3">
            {statusCode === 500 ? 'Server error' : 'Something went wrong'}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            {message || (
              statusCode === 500
                ? 'An unexpected error occurred on the server.'
                : 'An unexpected error occurred.'
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  const message = err?.message;
  return { statusCode, message };
};
