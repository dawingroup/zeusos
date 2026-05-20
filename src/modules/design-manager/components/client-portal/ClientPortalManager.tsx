/**
 * Client Portal Manager
 * Team-side component to manage deliverables, approval items, messages, and SketchUp models
 * for client portal integration
 */

import { useState, useEffect } from 'react';
import {
  FileText,
  Package,
  MessageSquare,
  Box,
  Plus,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import {
  getExtendedClientPortalData,
  sendPortalMessage,
  createDeliverable,
  createApprovalItem,
  registerSketchUpModel,
} from '../../services/clientPortalExtendedService';
import type {
  ProjectDeliverable,
  ClientApprovalItem,
  ClientPortalMessage,
  SketchUpModel,
  DeliverableType,
  ApprovalItemType,
} from '../../types/clientPortal';
import { useCurrentUserId } from '@/contexts/AuthContext';

interface ClientPortalManagerProps {
  projectId: string;
  projectName: string;
  clientName?: string;
  clientEmail?: string;
}

export default function ClientPortalManager({
  projectId,
  projectName: _projectName,
  clientName = 'Client',
  clientEmail: _clientEmail,
}: ClientPortalManagerProps) {
  const [loading, setLoading] = useState(true);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [approvalItems, setApprovalItems] = useState<ClientApprovalItem[]>([]);
  const [messages, setMessages] = useState<ClientPortalMessage[]>([]);
  const [sketchupModels, setSketchupModels] = useState<SketchUpModel[]>([]);
  
  const [showAddDeliverable, setShowAddDeliverable] = useState(false);
  const [showAddApproval, setShowAddApproval] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    loadPortalData();
  }, [projectId]);

  const loadPortalData = async () => {
    try {
      const data = await getExtendedClientPortalData(projectId);
      setDeliverables(data.deliverables);
      setApprovalItems(data.approvalItems);
      setMessages(data.messages);
      setSketchupModels(data.sketchupModels);
    } catch (err) {
      console.error('Failed to load portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      await sendPortalMessage(
        projectId,
        undefined,
        'team',
        'Team',
        newMessage.trim(),
        'general'
      );
      setNewMessage('');
      await loadPortalData();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingApprovals = approvalItems.filter(i => i.status === 'pending').length;
  const unreadMessages = messages.filter(m => !m.isRead && m.senderType === 'client').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading portal data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Deliverables</span>
            </div>
            <p className="text-2xl font-bold mt-1">{deliverables.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Approvals</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {pendingApprovals > 0 && (
                <span className="text-orange-500">{pendingApprovals} pending</span>
              )}
              {pendingApprovals === 0 && approvalItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Messages</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {unreadMessages > 0 && (
                <Badge variant="destructive" className="mr-2">{unreadMessages} new</Badge>
              )}
              {messages.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">3D Models</span>
            </div>
            <p className="text-2xl font-bold mt-1">{sketchupModels.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="deliverables" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="messages">
            Messages
            {unreadMessages > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="3d-models">3D Models</TabsTrigger>
        </TabsList>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Project Deliverables</h3>
            <Button size="sm" onClick={() => setShowAddDeliverable(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Deliverable
            </Button>
          </div>

          {deliverables.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No deliverables uploaded yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddDeliverable(true)}
                >
                  Upload First Deliverable
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {deliverables.map((d) => (
                <Card key={d.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {d.type} • v{d.version} • {formatDate(d.createdAt)}
                        </p>
                      </div>
                      <Badge variant={d.status === 'available' ? 'default' : 'outline'}>
                        {d.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Approval Items</h3>
            <Button size="sm" onClick={() => setShowAddApproval(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>

          {approvalItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No items requiring approval</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddApproval(true)}
                >
                  Add First Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {approvalItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      {item.status === 'approved' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {item.status === 'pending' && <Clock className="h-5 w-5 text-orange-500" />}
                      {item.status === 'rejected' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.type} • {item.quantity} {item.unit} • {item.totalCost.toLocaleString()} {item.currency}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === 'approved' ? 'default' :
                          item.status === 'rejected' ? 'destructive' : 'outline'
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Client Messages</CardTitle>
              <CardDescription>
                Communication with {clientName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Message List */}
              <div className="max-h-[300px] overflow-y-auto space-y-3 mb-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Start a conversation with the client.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.senderType === 'team' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          msg.senderType === 'team'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.senderType === 'team' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {msg.senderName} • {formatDate(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message to the client..."
                  className="min-h-[40px] max-h-[80px] resize-none"
                  rows={1}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  size="icon"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3D Models Tab */}
        <TabsContent value="3d-models" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">SketchUp Models</h3>
            <Button size="sm" onClick={() => setShowAddModel(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Model
            </Button>
          </div>

          {sketchupModels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No 3D models uploaded yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddModel(true)}
                >
                  Upload First Model
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sketchupModels.map((model) => (
                <Card key={model.id}>
                  <CardContent className="pt-4">
                    {model.thumbnailUrl && (
                      <img
                        src={model.thumbnailUrl}
                        alt={model.name}
                        className="w-full h-32 object-cover rounded mb-3"
                      />
                    )}
                    <p className="font-medium">{model.name}</p>
                    <p className="text-sm text-muted-foreground">
                      v{model.version} • {formatDate(model.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Deliverable Dialog */}
      <AddDeliverableDialog
        open={showAddDeliverable}
        onOpenChange={setShowAddDeliverable}
        projectId={projectId}
        onSuccess={loadPortalData}
      />

      {/* Add Approval Item Dialog */}
      <AddApprovalDialog
        open={showAddApproval}
        onOpenChange={setShowAddApproval}
        projectId={projectId}
        onSuccess={loadPortalData}
      />

      {/* Add Model Dialog */}
      <AddModelDialog
        open={showAddModel}
        onOpenChange={setShowAddModel}
        projectId={projectId}
        onSuccess={loadPortalData}
      />
    </div>
  );
}

// ============================================================================
// ADD DELIVERABLE DIALOG
// ============================================================================

function AddDeliverableDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}) {
  const userId = useCurrentUserId();
  const [name, setName] = useState('');
  const [type, setType] = useState<DeliverableType>('drawing');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !fileUrl) return;

    setSubmitting(true);
    try {
      // Create a placeholder File from the URL for the upload-based service
      const placeholderFile = new File([new Blob()], name, { type: 'application/octet-stream' });
      await createDeliverable(projectId, name, type, placeholderFile, userId, {
        description: description || undefined,
        requiresPayment: false,
      });
      onOpenChange(false);
      setName('');
      setDescription('');
      setFileUrl('');
      onSuccess();
    } catch (err) {
      console.error('Failed to create deliverable:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Deliverable</DialogTitle>
          <DialogDescription>
            Upload a file for the client to access
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Floor Plans v1"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drawing">2D Drawing</SelectItem>
                <SelectItem value="model">3D Model</SelectItem>
                <SelectItem value="specification">Specification</SelectItem>
                <SelectItem value="cutlist">Cut List</SelectItem>
                <SelectItem value="bom">Bill of Materials</SelectItem>
                <SelectItem value="render">Render</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File URL</Label>
            <Input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the URL to the file (Firebase Storage, Google Drive, etc.)
            </p>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !fileUrl || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Deliverable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ADD APPROVAL ITEM DIALOG
// ============================================================================

function AddApprovalDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}) {
  const userId = useCurrentUserId();
  const [name, setName] = useState('');
  const [type, setType] = useState<ApprovalItemType>('material');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [unitCost, setUnitCost] = useState('0');
  const [currency, setCurrency] = useState('UGX');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name) return;

    setSubmitting(true);
    try {
      await createApprovalItem(
        projectId,
        type,
        name,
        parseInt(quantity) || 1,
        parseFloat(unitCost) || 0,
        userId,
        {
          description: description || undefined,
          unit,
          currency,
        }
      );
      onOpenChange(false);
      setName('');
      setDescription('');
      setQuantity('1');
      setUnitCost('0');
      onSuccess();
    } catch (err) {
      console.error('Failed to create approval item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Approval Item</DialogTitle>
          <DialogDescription>
            Add a material or part that requires client approval
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mahogany Veneer"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ApprovalItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="standard_part">Standard Part</SelectItem>
                <SelectItem value="special_part">Special Part</SelectItem>
                <SelectItem value="procurement">Procurement Item</SelectItem>
                <SelectItem value="design_change">Design Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, sqm, sheets..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Unit Cost</Label>
              <Input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about this item..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ADD MODEL DIALOG
// ============================================================================

function AddModelDialog({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modelFileUrl, setModelFileUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [viewerEmbedUrl, setViewerEmbedUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !modelFileUrl) return;

    setSubmitting(true);
    try {
      await registerSketchUpModel(projectId, name, modelFileUrl, {
        description: description || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        viewerEmbedUrl: viewerEmbedUrl || undefined,
      });
      onOpenChange(false);
      setName('');
      setDescription('');
      setModelFileUrl('');
      setThumbnailUrl('');
      setViewerEmbedUrl('');
      onSuccess();
    } catch (err) {
      console.error('Failed to register model:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add 3D Model</DialogTitle>
          <DialogDescription>
            Register a SketchUp model for client viewing
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kitchen Design v2"
            />
          </div>
          <div>
            <Label>Model File URL (.skp)</Label>
            <Input
              value={modelFileUrl}
              onChange={(e) => setModelFileUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Thumbnail URL (optional)</Label>
            <Input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Viewer Embed URL (optional)</Label>
            <Input
              value={viewerEmbedUrl}
              onChange={(e) => setViewerEmbedUrl(e.target.value)}
              placeholder="https://3dwarehouse.sketchup.com/embed/..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload to 3D Warehouse for web viewing
            </p>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Model description..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !modelFileUrl || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
