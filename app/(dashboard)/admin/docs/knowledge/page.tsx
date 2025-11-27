/**
 * Knowledge Management System Documentation
 *
 * Module 8: Document repository, wiki pages, best practices, and knowledge sharing.
 */

import { DocPageHeader, MermaidDiagram, RoleAccessTable } from '@/components/docs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Lightbulb } from 'lucide-react';

const uploadDocumentChart = `flowchart TD
    A["New document<br/>to share"] --> B["Knowledge ><br/>Upload Document"]
    B --> C["Enter document<br/>title & description"]
    C --> D["Select category"]
    D --> E["Add tags<br/>for searchability"]
    E --> F["Upload file<br/>or enter URL"]
    F --> G["Set visibility<br/>permissions"]
    G --> H["Submit document"]
    H --> I["Document indexed<br/>& searchable"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const createWikiChart = `flowchart TD
    A["Knowledge to<br/>document"] --> B["Knowledge ><br/>Wiki > New Page"]
    B --> C["Enter page title"]
    C --> D["Write content<br/>using Markdown"]
    D --> E["Add images<br/>and links"]
    E --> F["Set category<br/>and tags"]
    F --> G["Preview page"]
    G --> H{{"Ready to publish?"}}
    H -->|Yes| I["Publish page"]
    H -->|No| J["Save as draft"]
    I --> K["Page live &<br/>version tracked"]

    style A fill:#f0f9ff
    style K fill:#dcfce7
    style H fill:#fef3c7`;

const shareBestPracticeChart = `flowchart TD
    A["Successful<br/>initiative"] --> B["Knowledge ><br/>Best Practices > New"]
    B --> C["Describe the<br/>practice"]
    C --> D["Add context:<br/>Challenge faced"]
    D --> E["Document solution<br/>and approach"]
    E --> F["Include results<br/>and metrics"]
    F --> G["Add attachments<br/>if any"]
    G --> H["Submit for<br/>review"]
    H --> I["Published to<br/>national library"]

    style A fill:#f0f9ff
    style I fill:#dcfce7`;

const searchKnowledgeChart = `flowchart TD
    A["Need information"] --> B["Knowledge ><br/>Search"]
    B --> C["Enter search<br/>keywords"]
    C --> D["Filter by type:<br/>Docs/Wiki/Practices"]
    D --> E["Filter by<br/>category"]
    E --> F["Review results"]
    F --> G["Open document<br/>or page"]
    G --> H["Download or<br/>bookmark"]

    style A fill:#f0f9ff
    style H fill:#dcfce7`;

const roleAccesses = [
  {
    role: 'Super Admin / National Admin',
    access: 'full' as const,
    permissions: ['Full repository access', 'Cross-chapter content', 'Manage categories', 'Approve best practices']
  },
  {
    role: 'Executive Member',
    access: 'full' as const,
    permissions: ['Upload documents', 'Create wiki pages', 'Submit best practices', 'Manage categories']
  },
  {
    role: 'Chair / Co-Chair',
    access: 'full' as const,
    permissions: ['Upload documents', 'Create wiki pages', 'Submit best practices', 'View analytics']
  },
  {
    role: 'EC Member',
    access: 'limited' as const,
    permissions: ['Upload documents', 'Create wiki pages', 'View all content', 'Download documents']
  },
  {
    role: 'Yi Member',
    access: 'view' as const,
    permissions: ['View documents', 'View wiki pages', 'View best practices', 'Download permitted files']
  }
];

export default function KnowledgeDocPage() {
  return (
    <div className="space-y-8">
      <DocPageHeader
        title="Knowledge Management System"
        description="Centralized digital repository for documents, wiki pages, best practices, and institutional knowledge with full-text search."
        icon={BookOpen}
        moduleNumber={8}
      />

      {/* Purpose */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Purpose & Objectives</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              The Knowledge Management System preserves institutional knowledge, making it
              searchable and accessible. It ensures documentation persists across leadership
              transitions and enables knowledge sharing between chapters.
            </p>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Document Library</h4>
                <p className="text-sm text-muted-foreground">MoUs, reports, templates</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Wiki Pages</h4>
                <p className="text-sm text-muted-foreground">Collaborative documentation</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Best Practices</h4>
                <p className="text-sm text-muted-foreground">Shared success stories</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Full-Text Search</h4>
                <p className="text-sm text-muted-foreground">Find anything quickly</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Content Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Content Types</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- MoUs and agreements</li>
                <li>- Event reports</li>
                <li>- Financial statements</li>
                <li>- Meeting minutes</li>
                <li>- Templates and forms</li>
                <li>- Training materials</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Wiki Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- How-to guides</li>
                <li>- Process documentation</li>
                <li>- SOPs and policies</li>
                <li>- Onboarding guides</li>
                <li>- FAQ pages</li>
                <li>- Event playbooks</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Successful event formats</li>
                <li>- Fundraising strategies</li>
                <li>- Member engagement tips</li>
                <li>- Sponsorship approaches</li>
                <li>- Crisis management</li>
                <li>- Innovation stories</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Document Categories */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Document Categories</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { name: 'Reports', color: 'bg-blue-500', desc: 'Event & annual reports' },
                { name: 'Agreements', color: 'bg-green-500', desc: 'MoUs & contracts' },
                { name: 'Templates', color: 'bg-purple-500', desc: 'Forms & documents' },
                { name: 'Policies', color: 'bg-orange-500', desc: 'SOPs & guidelines' },
                { name: 'Training', color: 'bg-pink-500', desc: 'Learning materials' },
                { name: 'Minutes', color: 'bg-cyan-500', desc: 'Meeting records' },
                { name: 'Financial', color: 'bg-yellow-500', desc: 'Budget & accounts' },
                { name: 'Media', color: 'bg-red-500', desc: 'Photos & videos' }
              ].map((cat) => (
                <div key={cat.name} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Role Access */}
      <RoleAccessTable accesses={roleAccesses} title="Role-Based Access" />

      {/* Workflows */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Workflows</h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 1: Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={uploadDocumentChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Knowledge &gt; Upload Document</code></li>
                  <li>Enter a descriptive title and summary</li>
                  <li>Select the appropriate category (Reports, Agreements, Templates, etc.)</li>
                  <li>Add relevant tags to improve searchability</li>
                  <li>Upload the file (PDF, Word, Excel, etc.) or link to external URL</li>
                  <li>Set visibility permissions (All members, EC only, etc.)</li>
                  <li>Submit the document - it will be indexed for search</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 2: Create Wiki Page</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={createWikiChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Knowledge &gt; Wiki &gt; New Page</code></li>
                  <li>Enter a clear, descriptive page title</li>
                  <li>Write content using Markdown formatting:
                    <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                      <li>Use <code className="bg-muted px-1 rounded"># Headings</code> for structure</li>
                      <li>Use <code className="bg-muted px-1 rounded">**bold**</code> and <code className="bg-muted px-1 rounded">*italic*</code> for emphasis</li>
                      <li>Use <code className="bg-muted px-1 rounded">- lists</code> for bullet points</li>
                    </ul>
                  </li>
                  <li>Add images by uploading or linking</li>
                  <li>Assign category and add searchable tags</li>
                  <li>Preview the page before publishing</li>
                  <li>Publish immediately or save as draft for later</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 3: Share Best Practice</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={shareBestPracticeChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Knowledge &gt; Best Practices &gt; New</code></li>
                  <li>Give the practice a descriptive title</li>
                  <li>Describe the challenge or problem you faced</li>
                  <li>Explain your solution and approach</li>
                  <li>Include measurable results and outcomes</li>
                  <li>Attach supporting documents, photos, or data</li>
                  <li>Submit for review - approved practices are shared nationally</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow 4: Search Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent>
              <MermaidDiagram chart={searchKnowledgeChart} />
              <div className="mt-4 space-y-3">
                <h4 className="font-medium">Step-by-Step:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Navigate to <code className="bg-muted px-1 rounded">Knowledge</code> dashboard</li>
                  <li>Use the search bar to enter keywords</li>
                  <li>Filter results by content type (Documents, Wiki, Best Practices)</li>
                  <li>Further filter by category if needed</li>
                  <li>Sort by relevance, date, or popularity</li>
                  <li>Click to view full document or page</li>
                  <li>Download, bookmark, or share as needed</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Supported File Types */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Supported File Types</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="font-medium mb-2">Documents</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>PDF (.pdf)</li>
                  <li>Word (.doc, .docx)</li>
                  <li>Excel (.xls, .xlsx)</li>
                  <li>PowerPoint (.ppt, .pptx)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Images</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>JPEG (.jpg, .jpeg)</li>
                  <li>PNG (.png)</li>
                  <li>GIF (.gif)</li>
                  <li>WebP (.webp)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Other</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Text (.txt)</li>
                  <li>CSV (.csv)</li>
                  <li>ZIP archives (.zip)</li>
                  <li>External URLs</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              <strong>File size limit:</strong> 50MB per file. Contact admin for larger files.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Version Control */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Version Control</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              Wiki pages support version history, allowing you to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                View previous versions of any page
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Compare changes between versions
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Restore to a previous version if needed
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                See who made each edit and when
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Tips & Best Practices</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Use Descriptive Titles</h4>
                <p className="text-sm text-muted-foreground">
                  Write clear, specific titles like &quot;Q3 2024 Event Report - Leadership Summit&quot;
                  rather than generic names like &quot;Report&quot;.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Add Comprehensive Tags</h4>
                <p className="text-sm text-muted-foreground">
                  Include relevant tags to improve searchability. Tags like &quot;2024&quot;, &quot;leadership&quot;,
                  &quot;training&quot; help others find your content.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Document Post-Event</h4>
                <p className="text-sm text-muted-foreground">
                  Upload event reports and photos within 48 hours while details are fresh.
                  This ensures nothing is lost.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Share Best Practices</h4>
                <p className="text-sm text-muted-foreground">
                  If something worked well for your chapter, document it as a best practice.
                  Other chapters benefit from your experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
