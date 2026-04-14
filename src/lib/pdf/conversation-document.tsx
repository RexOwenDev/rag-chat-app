/**
 * ConversationDocument — @react-pdf/renderer template for conversation exports.
 *
 * Server-only: imported exclusively by the export API route.
 * No hooks, no browser APIs — pure presentation using react-pdf primitives.
 */
import 'server-only';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.registerHyphenationCallback((word) => [word]); // disable hyphenation

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#64748b',
  },
  messageWrapper: {
    marginBottom: 14,
  },
  roleLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  roleLabelUser: {
    color: '#0891b2',
  },
  roleLabelAssistant: {
    color: '#64748b',
  },
  bubble: {
    padding: 10,
    borderRadius: 6,
    lineHeight: 1.6,
  },
  bubbleUser: {
    backgroundColor: '#e0f2fe',
    borderLeftWidth: 3,
    borderLeftColor: '#0891b2',
    borderLeftStyle: 'solid',
  },
  bubbleAssistant: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#94a3b8',
    borderLeftStyle: 'solid',
  },
  bubbleText: {
    fontSize: 10,
    color: '#1e293b',
  },
  citationsSection: {
    marginTop: 6,
    paddingLeft: 4,
  },
  citationsLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    marginBottom: 2,
  },
  citationItem: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
  },
  evalRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingLeft: 4,
  },
  evalBadge: {
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#94a3b8',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfMessage {
  id: string;
  role: string;
  content: string;
  citedDocTitles: string[];
  faithfulnessScore: number | null;
  relevanceScore: number | null;
}

interface ConversationDocumentProps {
  title: string;
  workspaceName: string;
  exportedAt: string;
  messages: PdfMessage[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function evalBadgeColors(score: number): { bg: string; text: string } {
  if (score >= 0.8) return { bg: '#dcfce7', text: '#16a34a' };
  if (score >= 0.6) return { bg: '#fef9c3', text: '#ca8a04' };
  return { bg: '#fee2e2', text: '#dc2626' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationDocument({
  title,
  workspaceName,
  exportedAt,
  messages,
}: ConversationDocumentProps) {
  return (
    <Document title={title} author="RAG Knowledge Base" creator="RAG Knowledge Base">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerMeta}>
            {workspaceName} · Exported {exportedAt}
          </Text>
        </View>

        {/* Messages */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <View key={msg.id} style={styles.messageWrapper} wrap={false}>
              <Text
                style={[
                  styles.roleLabel,
                  isUser ? styles.roleLabelUser : styles.roleLabelAssistant,
                ]}
              >
                {isUser ? 'You' : 'Assistant'}
              </Text>

              <View
                style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
              >
                <Text style={styles.bubbleText}>{msg.content}</Text>
              </View>

              {/* Cited sources */}
              {msg.citedDocTitles.length > 0 && (
                <View style={styles.citationsSection}>
                  <Text style={styles.citationsLabel}>Sources</Text>
                  {msg.citedDocTitles.map((docTitle, i) => (
                    <Text key={i} style={styles.citationItem}>
                      · {docTitle}
                    </Text>
                  ))}
                </View>
              )}

              {/* Eval scores */}
              {(msg.faithfulnessScore != null || msg.relevanceScore != null) && (
                <View style={styles.evalRow}>
                  {msg.faithfulnessScore != null && (
                    <Text
                      style={[
                        styles.evalBadge,
                        evalBadgeColors(msg.faithfulnessScore),
                      ]}
                    >
                      Faithful: {(msg.faithfulnessScore * 100).toFixed(0)}%
                    </Text>
                  )}
                  {msg.relevanceScore != null && (
                    <Text
                      style={[
                        styles.evalBadge,
                        evalBadgeColors(msg.relevanceScore),
                      ]}
                    >
                      Relevant: {(msg.relevanceScore * 100).toFixed(0)}%
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Footer with page numbers */}
        <View style={styles.footer} fixed>
          <Text>RAG Knowledge Base — Conversation Export</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
