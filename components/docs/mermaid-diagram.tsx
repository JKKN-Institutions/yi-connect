/**
 * Mermaid Diagram Component
 *
 * Client-side rendered Mermaid diagrams for flowcharts and other visualizations.
 * Responsive design with horizontal scrolling on mobile.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MermaidDiagramProps {
  chart: string;
  title?: string;
  className?: string;
}

export function MermaidDiagram({ chart, title, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import mermaid
        const mermaid = (await import('mermaid')).default;

        // Initialize mermaid with custom config
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 30,
            rankSpacing: 40
          },
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#1e293b',
            primaryBorderColor: '#3b82f6',
            lineColor: '#64748b',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#e2e8f0',
            fontSize: '14px'
          }
        });

        // Generate unique ID for the diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [chart]);

  const content = (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center justify-center min-h-[150px] sm:min-h-[200px]',
        className
      )}
    >
      {isLoading && (
        <div className="flex items-center justify-center py-6 sm:py-8">
          <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="text-center py-6 sm:py-8">
          <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
          <pre className="mt-3 sm:mt-4 text-xs bg-muted p-3 sm:p-4 rounded-lg overflow-x-auto text-left max-w-full">
            {chart}
          </pre>
        </div>
      )}
      {!isLoading && !error && svg && (
        <div className="w-full overflow-x-auto pb-2 -mx-2 px-2">
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:min-w-[280px] [&_svg]:max-w-none sm:[&_svg]:max-w-full mx-auto"
          />
        </div>
      )}
    </div>
  );

  if (title) {
    return (
      <Card className="my-4 sm:my-6">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">{content}</CardContent>
      </Card>
    );
  }

  return content;
}
