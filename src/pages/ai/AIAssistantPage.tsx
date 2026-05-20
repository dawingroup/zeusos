/**
 * AIAssistantPage
 * AI Assistant interface
 */

import { Helmet } from 'react-helmet-async';
import { Bot, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';

export default function AIAssistantPage() {
  return (
    <>
      <Helmet>
        <title>AI Assistant | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">Get help with your work using AI</p>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Chat Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Start a conversation with the AI assistant</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Input placeholder="Ask me anything..." className="flex-1" />
              <Button>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
