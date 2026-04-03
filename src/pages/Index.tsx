import { Car, Store, ArrowRight, Zap, Shield, BarChart3, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();

  const handleNav = (target: 'driver' | 'store') => {
    if (user && profile?.role === target) {
      navigate(`/${target}`);
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="gradient-dark text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl mb-4">
            Delivery<span className="text-gradient-primary"> Marketplace</span>
          </h1>
          <p className="text-primary-foreground/70 text-lg max-w-md mx-auto mb-8">
            A dual-sided marketplace connecting drivers and restaurants in real-time
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-heading gradient-primary shadow-primary text-primary-foreground"
              onClick={() => navigate('/order')}
            >
              <ShoppingBag className="mr-2 h-5 w-5" />
              Order Food
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg font-heading border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => handleNav('driver')}
            >
              <Car className="mr-2 h-5 w-5" />
              Driver App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-8 text-lg font-heading border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => handleNav('store')}
            >
              <Store className="mr-2 h-5 w-5" />
              Store App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="font-heading font-bold text-2xl text-center text-foreground mb-8">
          Built for Scale
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Zap}
            title="Real-time Updates"
            description="WebSocket-powered order syncing between drivers and stores"
          />
          <FeatureCard
            icon={Shield}
            title="Secure & Reliable"
            description="Row-level security, auth, and conflict resolution built-in"
          />
          <FeatureCard
            icon={BarChart3}
            title="Analytics"
            description="Earnings tracking, prep time optimization, and performance metrics"
          />
        </div>
      </div>
    </div>
  );
};

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card className="shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-shadow">
      <CardContent className="p-6 text-center">
        <div className="h-12 w-12 rounded-xl gradient-primary shadow-primary flex items-center justify-center mx-auto mb-4">
          <Icon className="h-6 w-6 text-primary-foreground" />
        </div>
        <h3 className="font-heading font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default Index;
