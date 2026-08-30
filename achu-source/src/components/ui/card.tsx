import * as React from "react"; import {cn} from "@/lib/utils";
const Card=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...p},r)=><div ref={r} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm",className)} {...p}/>); Card.displayName="Card";
const CardHeader=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...p},r)=><div ref={r} className={cn("flex flex-col space-y-1.5 p-6",className)} {...p}/>); CardHeader.displayName="CardHeader";
const CardTitle=React.forwardRef<HTMLParagraphElement,React.HTMLAttributes<HTMLHeadingElement>>(({className,...p},r)=><h3 ref={r} className={cn("text-2xl font-semibold leading-none tracking-tight",className)} {...p}/>); CardTitle.displayName="CardTitle";
const CardDescription=React.forwardRef<HTMLParagraphElement,React.HTMLAttributes<HTMLParagraphElement>>(({className,...p},r)=><p ref={r} className={cn("text-sm text-muted-foreground",className)} {...p}/>); CardDescription.displayName="CardDescription";
const CardContent=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...p},r)=><div ref={r} className={cn("p-6 pt-0",className)} {...p}/>); CardContent.displayName="CardContent";
const CardFooter=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...p},r)=><div ref={r} className={cn("flex items-center p-6 pt-0",className)} {...p}/>); CardFooter.displayName="CardFooter";
export {Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter};

