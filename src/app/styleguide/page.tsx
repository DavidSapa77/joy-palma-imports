import type { Metadata } from "next";
import {
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToastDemo } from "./toast-demo";

// Temporary design preview (Task 0.2). Remove once the real screens exist.
export const metadata: Metadata = {
  title: "Styleguide · Joy Palma Imports",
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "primary", className: "bg-primary", hex: "#0F4C5C" },
  { name: "gold (accent)", className: "bg-gold", hex: "#E09F3E" },
  { name: "success", className: "bg-success", hex: "#2E7D32" },
  { name: "warning", className: "bg-warning", hex: "#ED8936" },
  { name: "danger", className: "bg-danger", hex: "#C53030" },
  { name: "background", className: "bg-background", hex: "#F7F8FA" },
  { name: "surface", className: "bg-card", hex: "#FFFFFF" },
  { name: "border", className: "bg-border", hex: "#E3E6EA" },
  { name: "text", className: "bg-foreground", hex: "#1A202C" },
  { name: "muted", className: "bg-muted-foreground", hex: "#6B7280" },
] as const;

type StockState = "in" | "low" | "out";

// Sample data only — money shown as preformatted strings until lib/money.ts exists (Task 1.2).
const products: {
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  state: StockState;
  sold30: number;
}[] = [
  {
    name: "Rice Cooker 1.8L",
    sku: "JPI-00001",
    category: "Kitchenware",
    price: "₵380.00",
    stock: 24,
    state: "in",
    sold30: 84,
  },
  {
    name: "Bluetooth Speaker",
    sku: "JPI-00002",
    category: "Electronics",
    price: "₵1,250.00",
    stock: 3,
    state: "low",
    sold30: 41,
  },
  {
    name: "Ladies' Ankara Dress",
    sku: "JPI-00003",
    category: "Clothing",
    price: "₵145.50",
    stock: 0,
    state: "out",
    sold30: 17,
  },
  {
    name: "Shea Butter Lotion 500ml",
    sku: "JPI-00004",
    category: "Beauty",
    price: "₵45.00",
    stock: 112,
    state: "in",
    sold30: 6,
  },
];

function StockBadge({ stock, state }: { stock: number; state: StockState }) {
  if (state === "out") return <Badge variant="danger">Out of stock</Badge>;
  if (state === "low") return <Badge variant="warning">{stock} left</Badge>;
  return <Badge variant="success">{stock} in stock</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg leading-7 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-[1280px] space-y-10 px-4 py-8 md:px-6">
      <header className="space-y-1">
        <p className="text-xs leading-4 font-medium tracking-wide text-gold uppercase">
          Temporary preview
        </p>
        <h1 className="text-2xl leading-8 font-semibold">Joy Palma Imports — Styleguide</h1>
        <p className="text-sm text-muted-foreground">
          Theme tokens from UI_UX_SPEC §2. Body text is 14/20 Inter; figures use tabular numbers.
        </p>
      </header>

      <Section title="Colours">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-lg border bg-card">
              <div className={`h-14 ${s.className}`} />
              <div className="p-2 text-xs">
                <div className="font-medium">{s.name}</div>
                <div className="num text-muted-foreground">{s.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <ShoppingCart /> Complete sale
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Void sale</Button>
          <Button variant="link">View full report →</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="lg">
            <Plus /> New Sale
          </Button>
          <Button disabled>
            <Loader2 className="animate-spin" /> Saving…
          </Button>
          <Button disabled variant="outline">
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Form controls (44px tall below 640px)">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sg-search">Product search</Label>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput id="sg-search" placeholder="Name or SKU" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search">
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sg-payment">Payment method</Label>
            <Select defaultValue="CASH">
              <SelectTrigger id="sg-payment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
            <Checkbox id="sg-cost" defaultChecked />
            <Label htmlFor="sg-cost">Update product cost price</Label>
          </div>
          <div className="flex min-h-11 items-center gap-3 sm:min-h-0">
            <Switch id="sg-active" defaultChecked />
            <Label htmlFor="sg-active">Active</Label>
          </div>
        </div>
        <Tabs defaultValue="sales" className="max-w-md">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="prices">Prices</TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="text-sm text-muted-foreground">
            Units sold per month…
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">12 in stock</Badge>
          <Badge variant="warning">2 left</Badge>
          <Badge variant="danger">Out of stock</Badge>
          <Badge variant="danger">VOID</Badge>
          <Badge variant="gold">
            <Trophy /> Top seller
          </Badge>
          <Badge>OWNER</Badge>
          <Badge variant="secondary">MANAGER</Badge>
          <Badge variant="outline">VIEWER</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Revenue</CardDescription>
              <CardTitle className="text-xl leading-7 font-bold num sm:text-[28px] sm:leading-9">
                ₵12,450.00
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-1 text-xs text-success">
              <TrendingUp className="size-4" /> 12% vs last month
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Sales</CardDescription>
              <CardTitle className="text-xl leading-7 font-bold num sm:text-[28px] sm:leading-9">
                38
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-1 text-xs text-success">
              <TrendingUp className="size-4" /> 5%
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Items sold</CardDescription>
              <CardTitle className="text-xl leading-7 font-bold num sm:text-[28px] sm:leading-9">
                112
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-1 text-xs text-danger">
              <TrendingDown className="size-4" /> 3%
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Gross profit (after discounts)</CardDescription>
              <CardTitle className="text-xl leading-7 font-bold num sm:text-[28px] sm:leading-9">
                ₵3,980.00
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-1 text-xs text-success">
              <TrendingUp className="size-4" /> 8% · 32% margin
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Log a customer request</CardTitle>
            <CardDescription>What did the customer ask for?</CardDescription>
            <CardAction>
              <Badge variant="outline">Sales</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sg-item">Item</Label>
              <Input id="sg-item" placeholder="e.g. Rice cooker" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-qty">Quantity wanted (optional)</Label>
              <Input id="sg-qty" inputMode="numeric" placeholder="1" />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button>Save request</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Table">
        <div className="rounded-lg border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>In stock</TableHead>
                <TableHead className="hidden text-right md:table-cell">Sold (30 days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.sku}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.category}</TableCell>
                  <TableCell className="text-right num">{p.price}</TableCell>
                  <TableCell>
                    <StockBadge stock={p.stock} state={p.state} />
                  </TableCell>
                  <TableCell className="hidden text-right num md:table-cell">{p.sold30}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="hidden sm:table-cell">
                  4 products
                </TableCell>
                <TableCell className="sm:hidden">4 products</TableCell>
                <TableCell className="text-right num">₵1,820.50</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Section>

      <Section title="Toasts">
        <ToastDemo />
      </Section>
    </main>
  );
}
