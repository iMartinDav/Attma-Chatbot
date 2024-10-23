"use client"

import {Button} from "@/components/ui/button"
import Link from "next/link"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"

import {login} from "@/components/actions/login-action";
import {useFormState, useFormStatus} from 'react-dom'


export default function Page() {
    const [state, dispatch] = useFormState(login, {message: ""})
    return (
        <div className="flex h-screen w-full items-center justify-center px-4">
            <form action={dispatch}>
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="text-2xl">Login</CardTitle>
                        <CardDescription>
                            Enter your email below to login to your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="username" name="username" type="email" placeholder="m@example.com" required/>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            {/*<Link*/}
                            {/*    href="#"*/}
                            {/*    className="ml-auto inline-block text-sm underline"*/}
                            {/*>*/}
                            {/*    Forgot your password?*/}
                            {/*</Link>*/}
                            <Input id="password" name="password" type="password" required/>
                        </div>
                        <SubmitButton/>
                        <div>{state?.message && <p>{state.message}</p>}</div>
                        <div className="mt-4 text-center text-sm">
                            Don&apos;t have an account?{" "}
                            <Link href="/register" className="underline">
                                Sign up
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}

function SubmitButton() {
    const {pending} = useFormStatus()
    return (
        <Button className="w-full" type="submit" disabled={pending}>Sign in</Button>
    )
}