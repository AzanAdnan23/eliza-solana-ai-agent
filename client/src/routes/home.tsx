import { useQuery } from "@tanstack/react-query";
import { Cog } from "lucide-react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router";
import type { UUID } from "@elizaos/core";
import { formatAgentName } from "@/lib/utils";

export default function Home() {
    const query = useQuery({
        queryKey: ["agents"],
        queryFn: () => apiClient.getAgents(),
        refetchInterval: 5_000,
    });

    const agents = query?.data?.agents;

    return (
        <div className="flex flex-col gap-4 h-full p-4">
            <PageTitle title="Select Agent" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Dummy Card for EVM */}
                <Card>
                    <CardHeader>
                        <CardTitle>PLUGIN EVM</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md bg-muted aspect-square w-full grid place-items-center">
                            <div className="text-6xl font-bold lowercase">
                                evm
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <div className="flex items-center gap-4 w-full">
                            <Button variant="outline" className="w-full grow">
                                Chat
                            </Button>
                            <Button size="icon" variant="outline">
                                <Cog />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                {/* Dynamic Agent Cards */}
                {agents?.map((agent: { id: UUID; name: string }) => (
                    <Card key={agent.id}>
                        <CardHeader>
                            <CardTitle>PLUGIN {agent?.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md bg-muted aspect-square w-full grid place-items-center">
                                <div className="text-6xl font-bold lowercase">
                                    {formatAgentName(agent?.name)}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <div className="flex items-center gap-4 w-full">
                                <NavLink
                                    to={`/chat/${agent.id}`}
                                    className="w-full grow"
                                >
                                    <Button
                                        variant="outline"
                                        className="w-full grow"
                                    >
                                        Chat
                                    </Button>
                                </NavLink>
                                <NavLink
                                    to={`/settings/${agent.id}`}
                                    key={agent.id}
                                >
                                    <Button size="icon" variant="outline">
                                        <Cog />
                                    </Button>
                                </NavLink>
                            </div>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
