/**
 * DashboardPage
 * Main dashboard with stats and quick access to modules
 */

import { Helmet } from 'react-helmet-async';
import { 
  Building2, 
  TrendingUp, 
  Briefcase, 
  Package,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useAuth } from '@/shared/hooks';
import { StatsCard } from '@/shared/components/data-display/StatsCard';

export default function DashboardPage() {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const modules = [
    {
      id: 'delivery',
      title: 'Infrastructure Delivery',
      description: 'Manage construction projects, IPCs, and requisitions',
      icon: Building2,
      href: '/delivery',
      color: 'bg-blue-500',
    },
    {
      id: 'investment',
      title: 'Investment',
      description: 'Track deals, due diligence, and investment committee',
      icon: TrendingUp,
      href: '/investment',
      color: 'bg-green-500',
    },
    {
      id: 'advisory',
      title: 'Advisory',
      description: 'Manage portfolios, mandates, and client relationships',
      icon: Briefcase,
      href: '/advisory',
      color: 'bg-purple-500',
    },
    {
      id: 'matflow',
      title: 'MatFlow',
      description: 'BOQ management, materials, and procurement',
      icon: Package,
      href: '/matflow',
      color: 'bg-orange-500',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.displayName || 'User'}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your engagements today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Active Engagements"
            value={12}
            icon={Briefcase}
            trend={{ value: 8, isPositive: true }}
            description="from last month"
          />
          <StatsCard
            title="Infrastructure Projects"
            value={5}
            icon={Building2}
            trend={{ value: 2, isPositive: true }}
            description="in progress"
          />
          <StatsCard
            title="Investment Deals"
            value={3}
            icon={TrendingUp}
            description="in pipeline"
          />
          <StatsCard
            title="Pending BOQs"
            value={8}
            icon={Package}
            description="awaiting review"
          />
        </div>

        {/* Module Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {modules.map((module) => (
                <Link
                  key={module.id}
                  to={module.href}
                  className="group block p-4 rounded-lg border hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${module.color}`}>
                      <module.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium group-hover:text-primary transition-colors">
                        {module.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {module.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Engagements</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/engagements">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                No recent engagements to display.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pending Approvals</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/delivery/approvals">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                No pending approvals.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
