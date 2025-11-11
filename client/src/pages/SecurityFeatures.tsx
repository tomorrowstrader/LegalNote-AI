import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, FileCheck2, Clock, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity?: 'info' | 'warning' | 'critical';
  signature?: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: Date;
}

export default function SecurityFeatures() {
  const { toast } = useToast();

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const { data: auditLogs = [] } = useQuery<AuditLog[]>({
    queryKey: ['/api/audit-trail'],
    select: (data) => data.slice(0, 10), // Last 10 events
  });

  const securityEvents = auditLogs.filter(
    log => log.action.startsWith('security_') || log.action.startsWith('cleanup.')
  );

  const failedLogins = auditLogs.filter(
    log => log.action === 'security_event' && log.details.includes('failed_login')
  ).length;

  const suspiciousActivity = auditLogs.filter(
    log => log.action === 'security_event' && 
    (log.details.includes('ip_address_change') || log.details.includes('concurrent_session'))
  ).length;

  const handleExportAuditTrail = async () => {
    try {
      const response = await fetch('/api/audit-trail/export', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Audit Trail Exported',
        description: 'Cryptographically signed audit trail has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export audit trail. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="page-security-features">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Security & Compliance</h1>
        <p className="text-muted-foreground">
          Enterprise-grade security features designed for legal practice compliance
        </p>
      </div>

      {/* Security Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card data-testid="card-session-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Session Status</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground">
              Logged in as {user?.displayName}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-failed-logins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedLogins}</div>
            <p className="text-xs text-muted-foreground">
              In recent activity
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-suspicious-activity">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suspiciousActivity}</div>
            <p className="text-xs text-muted-foreground">
              Detected events
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-audit-logs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
            <FileCheck2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}+</div>
            <p className="text-xs text-muted-foreground">
              Signed events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Features Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Account Protection */}
        <Card data-testid="card-account-protection">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Account Protection</CardTitle>
            </div>
            <CardDescription>
              Prevents unauthorized access to client data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Failed Login Protection</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Accounts automatically lock after 5 failed login attempts for 15 minutes.
                Protects against brute force attacks.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">5 attempts</Badge>
                <Badge variant="outline">15 min lockout</Badge>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Session Timeout</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Sessions expire after 4 hours of inactivity with 5-minute warning.
                Prevents unauthorized access from unattended computers.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">4 hour timeout</Badge>
                <Badge variant="outline">5 min warning</Badge>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                Compliance
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </h4>
              <p className="text-sm text-muted-foreground">
                Meets SRA Code of Conduct Paragraphs 8.4 & 8.5 (Confidentiality)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Suspicious Activity Detection */}
        <Card data-testid="card-activity-monitoring">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle>Activity Monitoring</CardTitle>
            </div>
            <CardDescription>
              Detects unusual behavior and security threats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">IP Address Changes</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Logs when your account is accessed from different locations during the same session.
              </p>
              <Badge variant="outline">Real-time detection</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Concurrent Sessions</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Alerts when multiple active sessions are detected, indicating potential account compromise.
              </p>
              <Badge variant="outline">Automatic logging</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                Security Events
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </h4>
              <p className="text-sm text-muted-foreground">
                All events logged with severity levels for incident response
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tamper-Evident Audit Trail */}
        <Card data-testid="card-audit-trail">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-primary" />
              <CardTitle>Tamper-Evident Audit Trail</CardTitle>
            </div>
            <CardDescription>
              Cryptographically signed records of all system actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Cryptographic Signatures</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Every action is signed with HMAC-SHA256. Any attempt to alter logs is immediately detectable.
              </p>
              <Badge variant="outline">HMAC-SHA256</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Legal Defensibility</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Creates an immutable record for dispute resolution, regulatory investigations, and insurance claims.
              </p>
              <Badge variant="outline">Court-admissible</Badge>
            </div>

            <div className="pt-2">
              <Button 
                onClick={handleExportAuditTrail}
                variant="outline" 
                className="w-full"
                data-testid="button-export-audit-trail"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Signed Audit Trail (CSV)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GDPR Data Retention */}
        <Card data-testid="card-data-retention">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Automated Data Retention</CardTitle>
            </div>
            <CardDescription>
              GDPR-compliant automatic deletion of client data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Audio Recordings</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Client recordings automatically deleted after 7 days. Minimizes data exposure risk.
              </p>
              <Badge variant="outline">7-day retention</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Share Links</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Expired share links deleted automatically with 7-day grace period.
              </p>
              <Badge variant="outline">Daily at 2:00 AM</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                GDPR Compliance
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Article 5(1)(c) - Data Minimization</li>
                <li>✓ Article 5(1)(e) - Storage Limitation</li>
                <li>✓ Article 32 - Security of Processing</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      {securityEvents.length > 0 && (
        <Card data-testid="card-recent-security-events">
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>
              Last {securityEvents.length} security-related events in your audit trail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {securityEvents.map((log) => {
                let details: any = {};
                try {
                  details = JSON.parse(log.details);
                } catch {}

                return (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-3 rounded-lg border"
                    data-testid={`security-event-${log.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        {log.severity && (
                          <Badge
                            variant={
                              log.severity === 'critical'
                                ? 'destructive'
                                : log.severity === 'warning'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {log.severity}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), 'PPpp')} • {log.ipAddress}
                      </p>
                      {details.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reason: {details.reason}
                        </p>
                      )}
                    </div>
                    {log.signature && (
                      <div className="ml-4">
                        <Badge variant="outline" className="text-xs">
                          <FileCheck2 className="h-3 w-3 mr-1" />
                          Signed
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Summary */}
      <Card className="bg-muted/50" data-testid="card-compliance-summary">
        <CardHeader>
          <CardTitle>Regulatory Compliance Summary</CardTitle>
          <CardDescription>
            How these security features meet UK legal practice requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                GDPR (UK)
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• Article 5(1)(c) - Data Minimization</li>
                <li>• Article 5(1)(e) - Storage Limitation</li>
                <li>• Article 32 - Security of Processing</li>
                <li>• Article 33 - Breach Notification (audit logs)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                SRA Requirements
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• Code of Conduct 8.4 & 8.5 (Confidentiality)</li>
                <li>• Accounts Rule 12.1 (Data Security)</li>
                <li>• Law Society Cyber Security Guidance</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Professional Indemnity
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• Demonstrates due diligence</li>
                <li>• Reduces negligence risk</li>
                <li>• Defensible audit trail</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                ICO Compliance
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• Avoids fines (up to £17.5M)</li>
                <li>• Automated compliance reporting</li>
                <li>• Data protection by design</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
