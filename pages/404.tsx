import Head from 'next/head';
import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page Not Found — Business OS</title>
      </Head>
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-[120px] font-bold text-slate-800 leading-none select-none">404</div>
          <h1 className="text-2xl font-semibold text-slate-200 mt-2 mb-3">Page not found</h1>
          <p className="text-slate-500 text-sm mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
