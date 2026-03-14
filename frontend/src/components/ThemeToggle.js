import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';

/**
 * Floating theme toggle for NON-dashboard pages.
 * On /dashboard the toggle is rendered inline inside the TopNav header
 * to avoid overlap with the notification bell — see Dashboard.js.
 */
const ThemeToggle = () => {
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();

  const isAdminPage = location.pathname.includes('/admin');
  const isDashboard = location.pathname.includes('/dashboard');
  const isLanding = location.pathname === '/';

  // Dashboard has its own inline toggle — skip the floating one
  if (isDashboard) return null;

  const topClass = isAdminPage ? 'top-[76px]' : isLanding ? 'top-5' : 'top-4';

  return (
    <motion.button
      onClick={toggleTheme}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={`fixed ${topClass} right-4 sm:right-6 z-[45] w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all duration-300 group border border-white/25 backdrop-blur-sm`}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
          : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        boxShadow: isDark
          ? '0 4px 15px rgba(99, 102, 241, 0.35)'
          : '0 4px 15px rgba(245, 158, 11, 0.35)',
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 360 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {isDark ? (
          <FaMoon className="text-white text-base sm:text-lg drop-shadow-md" />
        ) : (
          <FaSun className="text-white text-base sm:text-lg drop-shadow-md" />
        )}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-gray-900 dark:bg-gray-700 text-white text-[11px] px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </div>
      </div>
    </motion.button>
  );
};

export default ThemeToggle;