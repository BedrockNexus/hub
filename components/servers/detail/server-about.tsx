import { AboutSection } from '@/components/detail/about-section'

export function ServerAbout(props: { description?: string | null }) {
	return <AboutSection description={props.description} />
}
